// Lógica compartida de cuentas comerciales (directores de ventas).
// Se usa tanto en server.js (local) como en las funciones de Vercel (api/*.js),
// por eso recibe los modelos como parámetro en lugar de importarlos.

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIRECTOR_CONTRACT_VERSION = '1.0';
const DOCUMENT_TYPES = ['DNI', 'Cédula', 'Pasaporte'];

// Enlaces habilitados (Punto 9): qué cuenta puede traer a cada tipo de cuenta.
//   Empresa  → vendedores, directores y clientes
//   Director → vendedores, directores y clientes
//   Vendedor → solo clientes
const INVITE_RULES = {
    vendedor: ['admin', 'director'],
    director: ['admin', 'director'],
    user: ['admin', 'director', 'vendedor']
};
const ROLE_NAMES = { admin: 'la empresa', director: 'un director', vendedor: 'un vendedor' };

// Permisos por rol (Punto 10). Cada panel/endpoint comprueba el permiso, no el rol a mano.
const ROLE_PERMISSIONS = {
    admin:    ['sales.panel', 'sales.own', 'company.manage'],
    director: ['sales.panel', 'sales.own', 'team.view', 'directors.view'],
    vendedor: ['sales.panel', 'sales.own'],
    user:     []
};
function hasPermission(role, permission) {
    return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// Resuelve la relación que se guarda al registrar una cuenta:
// quién la invitó (referredBy + invitedByRole), con qué rol se registró (registeredRole)
// y a qué equipo pertenece (teamDirectorId).
// La fecha es createdAt. Sin enlace (o con un código inexistente) el responsable es la empresa.
// Si el código existe pero pertenece a una cuenta que no puede invitar ese rol, devuelve { error }.
async function resolveRelation(User, ref, role) {
    const allowed = INVITE_RULES[role] || INVITE_RULES.user;
    let inviter = null;
    const code = ref ? String(ref).trim() : '';
    if (code) {
        const owner = await User.findOne({ sellerCode: code }).select('_id role teamDirectorId');
        if (owner && allowed.includes(owner.role)) {
            inviter = owner;
        } else if (owner && role !== 'user') {
            const what = role === 'director' ? 'directores' : 'vendedores';
            return { error: `Este enlace no permite invitar ${what}: pertenece a ${ROLE_NAMES[owner.role] || 'otra cuenta'}.` };
        }
    }
    if (!inviter) inviter = await User.findOne({ role: 'admin' }).select('_id role teamDirectorId');

    return {
        referredBy: inviter ? inviter._id : null,
        invitedByRole: inviter ? inviter.role : null,
        registeredRole: role,
        teamDirectorId: teamDirectorOf(inviter)
    };
}

// Equipo que hereda una cuenta (o una venta) según su responsable:
// director → su propio equipo; vendedor → el equipo de su director; empresa → null.
function teamDirectorOf(owner) {
    if (!owner) return null;
    if (owner.role === 'director') return owner._id;
    if (owner.role === 'vendedor') return owner.teamDirectorId || null;
    return null;
}

// Vinculación de una compra con su responsable comercial (Punto 10).
// Se fija al registrar el pago y no cambia aunque luego cambie el referido del cliente.
// Usa .lean() para leer teamDirectorId aunque el modelo User del proceso sea un esquema inline reducido.
async function purchaseAttribution(User, client) {
    const ownerId = client && client.referredBy;
    if (!ownerId) return { salesOwnerId: null, salesOwnerRole: null, teamDirectorId: null };
    const owner = await User.findById(ownerId).select('_id role teamDirectorId').lean();
    if (!owner) return { salesOwnerId: ownerId, salesOwnerRole: null, teamDirectorId: null };
    return {
        salesOwnerId: owner._id,
        salesOwnerRole: ['admin', 'director', 'vendedor'].includes(owner.role) ? owner.role : null,
        teamDirectorId: teamDirectorOf(owner)
    };
}

// Relación para cuentas sin enlace (Google/GitHub, alta por la empresa): responsable = empresa
async function companyRelation(User, role = 'user') {
    return resolveRelation(User, null, role);
}

// Código alfanumérico único, sin nombres ni documento (ej. TD7K92Q4)
async function generateUniqueCode(User, prefix) {
    for (let attempt = 0; attempt < 20; attempt++) {
        let rand = '';
        for (let i = 0; i < 6; i++) {
            rand += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        const code = `${prefix}${rand}`;
        if (!(await User.exists({ sellerCode: code }))) return code;
    }
    throw new Error('No se pudo generar un código único');
}

// Registro de Director de ventas por invitación (Punto 7).
// El rol siempre es 'director': el enlace no permite elegir otro rol.
// Devuelve { status, body } o { user } si se creó correctamente.
async function registerDirector(User, body) {
    const {
        name, lastName, email, password, country, phone, address,
        documentType, documentNumber, ref, termsAccepted, contractAccepted, contractVersion
    } = body || {};

    const required = [name, lastName, email, password, country, phone, address, documentType, documentNumber];
    if (required.some(v => !v || !String(v).trim())) {
        return { status: 400, body: { success: false, message: 'Todos los campos personales y de contacto son requeridos.' } };
    }
    if (String(password).length < 6) {
        return { status: 400, body: { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' } };
    }
    if (!/^\+\d{1,4}[\s-]?[\d\s-]{6,20}$/.test(String(phone).trim())) {
        return { status: 400, body: { success: false, message: 'El celular debe incluir el prefijo internacional (ej. +51 987654321).' } };
    }
    if (!DOCUMENT_TYPES.includes(documentType)) {
        return { status: 400, body: { success: false, message: 'Tipo de documento no válido.' } };
    }
    if (!termsAccepted || !contractAccepted) {
        return { status: 400, body: { success: false, message: 'Debes leer y aceptar los Términos y Condiciones y el Contrato del Director.' } };
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) {
        return { status: 409, body: { success: false, message: 'Este correo electrónico ya está registrado.' } };
    }

    // Quién lo invitó: solo la empresa o otro director (Punto 9)
    const relation = await resolveRelation(User, ref, 'director');
    if (relation.error) return { status: 403, body: { success: false, message: relation.error } };

    const now = new Date();
    const user = new User({
        name: String(name).trim(),
        lastName: String(lastName).trim(),
        email: normalizedEmail,
        password,
        country: String(country).trim(),
        phone: String(phone).trim(),
        address: String(address).trim(),
        documentType,
        documentNumber: String(documentNumber).trim(),
        role: 'director',
        sellerCode: await generateUniqueCode(User, 'TD'),
        referredBy: relation.referredBy,
        invitedByRole: relation.invitedByRole,
        teamDirectorId: relation.teamDirectorId,
        registeredRole: relation.registeredRole,
        termsAccepted: true,
        termsAcceptedAt: now,
        termsVersion: '1.0',
        contractVersion: contractVersion || DIRECTOR_CONTRACT_VERSION,
        contractAcceptedAt: now,
        sellerBalance: 0,
        sellerCommission: 10
    });
    await user.save();
    return { user };
}

// Rango de fechas de un mes para resúmenes de ventas (Punto 11).
// Si year o month no son válidos, recurre al mes actual.
function monthRange(year, month) {
    const now = new Date();
    const y = Number(year);
    const m = Number(month);
    const isValid = Number.isInteger(y) && y >= 2000 && y <= 2100 &&
                    Number.isInteger(m) && m >= 1 && m <= 12;
    const finalYear = isValid ? y : now.getFullYear();
    const finalMonth = isValid ? m : (now.getMonth() + 1);
    const start = new Date(finalYear, finalMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(finalYear, finalMonth, 0, 23, 59, 59, 999);
    return { year: finalYear, month: finalMonth, start, end };
}

// Obtiene los clientes de un conjunto de cuentas y todas sus ventas confirmadas (Payment con status 'paid').
// Si range está definido ({ start, end }), filtra los pagos por createdAt dentro del rango.
// Devuelve { clients, sales } donde clients son los usuarios referidos por ownerIds.
async function getAccountSales(User, Payment, Membership, ownerIds, range) {
    const validOwnerIds = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : [];
    const clients = validOwnerIds.length
        ? await User.find({ referredBy: { $in: validOwnerIds }, role: 'user' })
            .select('name lastName email phone country referredBy createdAt membershipPlan activeMembership membershipExpiresAt')
            .sort({ createdAt: -1 })
            .lean()
        : [];

    const clientIds = clients.map(c => c._id);
    const clientMap = new Map();
    clients.forEach(c => clientMap.set(String(c._id), c));

    const filter = {
        status: 'paid',
        $or: [
            { salesOwnerId: { $in: validOwnerIds } },
            // Pagos anteriores al Punto 10, sin vincular: se atribuyen por el referido del cliente
            { salesOwnerId: null, userId: { $in: clientIds } }
        ]
    };
    if (range && range.start && range.end) {
        filter.createdAt = { $gte: range.start, $lte: range.end };
    }

    const payments = validOwnerIds.length
        ? await Payment.find(filter).sort({ createdAt: -1 }).lean()
        : [];

    // Si un pago vinculado pertenece a un cliente que no está en la lista (su referredBy cambió después),
    // cargar esos clientes con una consulta extra por _id y la misma select.
    const missingClientIds = [...new Set(payments.map(p => String(p.userId)).filter(id => id && !clientMap.has(id)))];
    if (missingClientIds.length > 0) {
        const extraClients = await User.find({ _id: { $in: missingClientIds } })
            .select('name lastName email phone country referredBy createdAt membershipPlan activeMembership membershipExpiresAt')
            .lean();
        extraClients.forEach(c => clientMap.set(String(c._id), c));
    }

    const membershipIds = [...new Set(payments.map(p => p.membershipId).filter(Boolean))];
    const memberships = membershipIds.length
        ? await Membership.find({ _id: { $in: membershipIds } }).lean()
        : [];
    const membershipMap = new Map();
    memberships.forEach(m => membershipMap.set(String(m._id), m));

    const priceMap = await getPriceMap(Membership);

    const sales = payments.map(p => {
        const client = clientMap.get(String(p.userId)) || {};
        const membership = p.membershipId ? membershipMap.get(String(p.membershipId)) : null;
        const plan = membership?.name || client.membershipPlan || 'Membresía';
        const planKey = membership?.planType ? String(membership.planType).toLowerCase() : planKeyOf(plan);
        const amount = p.amountCents > 0 ? p.amountCents / 100 : (membership?.price || priceMap[planKey] || 0);

        return {
            paymentId: String(p._id),
            orderId: p.orderId || ('ORD-' + String(p._id).slice(-6).toUpperCase()),
            ownerId: String(p.salesOwnerId || client.referredBy || ''),
            clientId: String(p.userId),
            clientName: `${client.name || 'Cliente'} ${client.lastName || ''}`.trim(),
            clientEmail: client.email || '',
            plan,
            planKey,
            amount,
            currency: p.currency || membership?.currency || 'USD',
            kind: p.kind || 'checkout',
            date: p.createdAt,
            status: 'Confirmada'
        };
    });

    return { clients, sales };
}

// Clientes propios de una cuenta comercial (vendedor o director) para "Mis clientes".
// Devuelve un array con cada cliente y sus compras confirmadas (sin dirección ni documento).
async function getOwnClients(User, Payment, Membership, ownerId) {
    const { clients, sales } = await getAccountSales(User, Payment, Membership, [ownerId]);

    return clients.map(c => {
        const ownSales = sales.filter(s => s.clientId === String(c._id));
        const purchases = ownSales.map(s => ({
            orderId: s.orderId,
            plan: s.plan,
            amount: s.amount,
            currency: s.currency,
            date: s.date,
            status: s.status
        }));

        return {
            _id: c._id,
            name: c.name,
            lastName: c.lastName || '',
            email: c.email,
            phone: c.phone || '',
            country: c.country || '',
            createdAt: c.createdAt,
            membershipPlan: c.membershipPlan || null,
            hasMembership: isActive(c),
            purchases
        };
    });
}

// Resumen mensual de ventas personales de una cuenta (vendedor o director).
async function getPersonalMonthlySales(User, Payment, Membership, ownerId, year, month) {
    const range = monthRange(year, month);
    const { sales } = await getAccountSales(User, Payment, Membership, [ownerId], range);

    const buyerIdSet = new Set(sales.map(s => s.clientId));
    const uniqueBuyers = buyerIdSet.size;
    const totalSalesCount = sales.length;
    let totalAmount = 0;

    const byPlan = {
        mensual:  { count: 0, amount: 0, label: 'Plan Mensual' },
        anual:    { count: 0, amount: 0, label: 'Plan Anual' },
        trianual: { count: 0, amount: 0, label: 'Plan Trianual' },
        otro:     { count: 0, amount: 0, label: 'Otros planes' }
    };

    sales.forEach(s => {
        totalAmount += (s.amount || 0);
        const k = byPlan[s.planKey] ? s.planKey : 'otro';
        byPlan[k].count += 1;
        byPlan[k].amount += (s.amount || 0);
    });

    const monthSales = sales.map(({ ownerId: _omit, ...rest }) => rest);

    return {
        year: range.year,
        month: range.month,
        summary: {
            uniqueBuyers,
            totalSalesCount,
            totalAmount,
            byPlan,
            sales: monthSales
        }
    };
}

// Vendedores del equipo del director con sus ventas (Punto 11: usando getAccountSales)
async function getDirectorTeam(User, Payment, Membership, directorId) {
    const sellers = await User.find({ referredBy: directorId, role: 'vendedor' })
        .select('name lastName email phone country sellerCode createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const sellerIds = sellers.map(s => s._id);
    const { clients, sales } = await getAccountSales(User, Payment, Membership, sellerIds);
    const now = new Date();

    return sellers.map(s => {
        const id = String(s._id);
        const ownClients = clients.filter(c => String(c.referredBy) === id);
        const ownSales = sales.filter(sale => sale.ownerId === id);
        return {
            ...s,
            clientsCount: ownClients.length,
            activeClients: ownClients.filter(c => isActive(c, now)).length,
            salesCount: ownSales.length,
            salesTotal: ownSales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
        };
    });
}

// Directores invitados directamente por el director (Punto 8).
// Solo nombre y fecha: no se exponen sus clientes, vendedores ni datos de contacto.
// Los importes globales se incorporarán con las comisiones.
async function getDirectorDirectors(User, directorId) {
    const directors = await User.find({ referredBy: directorId, role: 'director' })
        .select('name lastName createdAt')
        .sort({ createdAt: -1 })
        .lean();
    return directors.map(d => ({ _id: d._id, name: d.name, lastName: d.lastName || '', createdAt: d.createdAt }));
}

function planKeyOf(plan) {
    const s = String(plan || '').toLowerCase();
    if (s.includes('trianual') || s.includes('trienal')) return 'trianual';
    if (s.includes('anual')) return 'anual';
    if (s.includes('mensual')) return 'mensual';
    return 'otro';
}

async function getPriceMap(Membership) {
    const priceMap = { mensual: 29, anual: 199, trianual: 399 };
    (await Membership.find().lean()).forEach(m => {
        if (m.planType) priceMap[String(m.planType).toLowerCase()] = m.price;
    });
    return priceMap;
}

const isActive = (u, now = new Date()) => !!(u.activeMembership && u.membershipExpiresAt && new Date(u.membershipExpiresAt) > now);

// Detalle de un vendedor directo del director: sus clientes y compras.
// Devuelve null si el vendedor no pertenece al equipo directo del director.
async function getSellerClients(User, Payment, Membership, directorId, sellerId) {
    if (!/^[a-f\d]{24}$/i.test(String(sellerId))) return null;
    const seller = await User.findOne({ _id: sellerId, referredBy: directorId, role: 'vendedor' })
        .select('name lastName email sellerCode createdAt')
        .lean();
    if (!seller) return null;

    const { clients, sales } = await getAccountSales(User, Payment, Membership, [seller._id]);

    return {
        seller,
        clients: clients.map(c => {
            const ownSales = sales.filter(s => s.clientId === String(c._id));
            const purchases = ownSales.map(p => ({
                orderId: p.orderId,
                plan: p.plan,
                amount: p.amount,
                date: p.date
            }));
            return {
                name: c.name,
                lastName: c.lastName || '',
                email: c.email,
                country: c.country || '',
                createdAt: c.createdAt,
                membershipPlan: c.membershipPlan || null,
                hasMembership: isActive(c),
                purchases
            };
        })
    };
}

// Ventas del mes de los vendedores directos del director (Punto 8: resumen separado, Punto 11: getAccountSales)
async function getTeamMonthlySales(User, Payment, Membership, directorId, year, month) {
    const range = monthRange(year, month);
    const sellers = await User.find({ referredBy: directorId, role: 'vendedor' }).select('name lastName').lean();
    const sellerMap = {};
    sellers.forEach(s => {
        sellerMap[String(s._id)] = `${s.name || ''} ${s.lastName || ''}`.trim() || 'Vendedor';
    });
    const sellerIds = sellers.map(s => s._id);

    const { sales: rawSales } = await getAccountSales(User, Payment, Membership, sellerIds, range);

    const sales = rawSales.map(s => ({
        sellerName: sellerMap[s.ownerId] || 'Vendedor',
        clientName: s.clientName,
        clientEmail: s.clientEmail,
        plan: s.plan,
        date: s.date,
        amount: s.amount
    }));

    const activeSellers = new Set(rawSales.map(s => s.ownerId)).size;

    return {
        year: range.year,
        month: range.month,
        totalSalesCount: sales.length,
        totalAmount: sales.reduce((sum, s) => sum + (s.amount || 0), 0),
        activeSellers,
        sales
    };
}

module.exports = {
    DIRECTOR_CONTRACT_VERSION,
    INVITE_RULES,
    ROLE_PERMISSIONS,
    hasPermission,
    resolveRelation,
    companyRelation,
    teamDirectorOf,
    purchaseAttribution,
    registerDirector,
    getDirectorTeam,
    getDirectorDirectors,
    getSellerClients,
    getTeamMonthlySales,
    monthRange,
    getAccountSales,
    getOwnClients,
    getPersonalMonthlySales
};
