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

// Resuelve la relación que se guarda al registrar una cuenta:
// quién la invitó (referredBy + invitedByRole) y con qué rol se registró (registeredRole).
// La fecha es createdAt. Sin enlace (o con un código inexistente) el responsable es la empresa.
// Si el código existe pero pertenece a una cuenta que no puede invitar ese rol, devuelve { error }.
async function resolveRelation(User, ref, role) {
    const allowed = INVITE_RULES[role] || INVITE_RULES.user;
    let inviter = null;
    const code = ref ? String(ref).trim() : '';
    if (code) {
        const owner = await User.findOne({ sellerCode: code }).select('_id role');
        if (owner && allowed.includes(owner.role)) {
            inviter = owner;
        } else if (owner && role !== 'user') {
            const what = role === 'director' ? 'directores' : 'vendedores';
            return { error: `Este enlace no permite invitar ${what}: pertenece a ${ROLE_NAMES[owner.role] || 'otra cuenta'}.` };
        }
    }
    if (!inviter) inviter = await User.findOne({ role: 'admin' }).select('_id role');
    return {
        referredBy: inviter ? inviter._id : null,
        invitedByRole: inviter ? inviter.role : null,
        registeredRole: role
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

// Vendedores del equipo del director con sus ventas
async function getDirectorTeam(User, Payment, directorId) {
    const sellers = await User.find({ referredBy: directorId, role: 'vendedor' })
        .select('name lastName email phone country sellerCode createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const sellerIds = sellers.map(s => s._id);
    const clients = await User.find({ referredBy: { $in: sellerIds }, role: 'user' })
        .select('referredBy activeMembership membershipExpiresAt')
        .lean();
    const payments = clients.length
        ? await Payment.find({ userId: { $in: clients.map(c => c._id) }, status: 'paid' }).select('userId amountCents').lean()
        : [];

    const clientOwner = {};
    clients.forEach(c => { clientOwner[String(c._id)] = String(c.referredBy); });
    const now = new Date();

    return sellers.map(s => {
        const id = String(s._id);
        const own = clients.filter(c => String(c.referredBy) === id);
        const ownPayments = payments.filter(p => clientOwner[String(p.userId)] === id);
        return {
            ...s,
            clientsCount: own.length,
            activeClients: own.filter(c => c.activeMembership && c.membershipExpiresAt && new Date(c.membershipExpiresAt) > now).length,
            salesCount: ownPayments.length,
            salesTotal: ownPayments.reduce((sum, p) => sum + (p.amountCents || 0) / 100, 0)
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
    if (s.includes('trianual')) return 'trianual';
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

    const clients = await User.find({ referredBy: seller._id, role: 'user' })
        .select('name lastName email country createdAt membershipPlan membershipExpiresAt activeMembership izipayLastOrderId')
        .sort({ createdAt: -1 })
        .lean();
    const payments = clients.length
        ? await Payment.find({ userId: { $in: clients.map(c => c._id) }, status: 'paid' }).sort({ createdAt: -1 }).lean()
        : [];
    const priceMap = await getPriceMap(Membership);

    return {
        seller,
        clients: clients.map(c => {
            const own = payments.filter(p => String(p.userId) === String(c._id));
            let purchases = own.map(p => ({
                orderId: p.orderId || ('ORD-' + String(p._id).slice(-6).toUpperCase()),
                plan: c.membershipPlan || 'Membresía',
                amount: p.amountCents ? p.amountCents / 100 : (priceMap[planKeyOf(c.membershipPlan)] || 0),
                date: p.createdAt
            }));
            if (!purchases.length && (c.activeMembership || c.membershipPlan)) {
                purchases = [{
                    orderId: c.izipayLastOrderId || ('ORD-' + String(c._id).slice(-6).toUpperCase()),
                    plan: c.membershipPlan || 'Membresía',
                    amount: priceMap[planKeyOf(c.membershipPlan)] || 0,
                    date: c.createdAt
                }];
            }
            return {
                name: c.name, lastName: c.lastName || '', email: c.email, country: c.country || '',
                createdAt: c.createdAt, membershipPlan: c.membershipPlan || null,
                hasMembership: isActive(c), purchases
            };
        })
    };
}

// Ventas del mes de los vendedores directos del director (Punto 8: resumen separado)
async function getTeamMonthlySales(User, Payment, Membership, directorId, year, month) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const sellers = await User.find({ referredBy: directorId, role: 'vendedor' }).select('name lastName').lean();
    const sellerName = {};
    sellers.forEach(s => { sellerName[String(s._id)] = `${s.name || ''} ${s.lastName || ''}`.trim(); });

    const clients = sellers.length
        ? await User.find({ referredBy: { $in: sellers.map(s => s._id) }, role: 'user' })
            .select('name lastName email referredBy createdAt membershipPlan activeMembership').lean()
        : [];
    const clientMap = {};
    clients.forEach(c => { clientMap[String(c._id)] = c; });

    const payments = clients.length
        ? await Payment.find({ userId: { $in: clients.map(c => c._id) }, status: 'paid', createdAt: { $gte: start, $lte: end } }).lean()
        : [];
    const priceMap = await getPriceMap(Membership);

    const toSale = (c, amount, date) => ({
        sellerName: sellerName[String(c.referredBy)] || 'Vendedor',
        clientName: `${c.name || 'Cliente'} ${c.lastName || ''}`.trim(),
        clientEmail: c.email || '',
        plan: c.membershipPlan || 'Membresía',
        date,
        amount
    });

    const sales = payments.map(p => {
        const c = clientMap[String(p.userId)] || {};
        return toSale(c, p.amountCents ? p.amountCents / 100 : (priceMap[planKeyOf(c.membershipPlan)] || 0), p.createdAt);
    });
    // Misma regla que el resumen personal: membresía sin pago registrado, contada en su mes de registro
    const paidIds = new Set(payments.map(p => String(p.userId)));
    clients.forEach(c => {
        const created = new Date(c.createdAt);
        if (!paidIds.has(String(c._id)) && created >= start && created <= end && (c.activeMembership || c.membershipPlan)) {
            sales.push(toSale(c, priceMap[planKeyOf(c.membershipPlan)] || 0, c.createdAt));
        }
    });
    sales.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        totalSalesCount: sales.length,
        totalAmount: sales.reduce((sum, s) => sum + (s.amount || 0), 0),
        activeSellers: new Set(sales.map(s => s.sellerName)).size,
        sales
    };
}

module.exports = {
    DIRECTOR_CONTRACT_VERSION,
    INVITE_RULES,
    resolveRelation,
    companyRelation,
    registerDirector,
    getDirectorTeam,
    getDirectorDirectors,
    getSellerClients,
    getTeamMonthlySales
};
