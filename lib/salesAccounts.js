// Lógica compartida de cuentas comerciales (directores de ventas).
// Se usa tanto en server.js (local) como en las funciones de Vercel (api/*.js),
// por eso recibe los modelos como parámetro en lugar de importarlos.

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIRECTOR_CONTRACT_VERSION = '1.0';
const DOCUMENT_TYPES = ['DNI', 'Cédula', 'Pasaporte'];

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

    // Quién lo invitó: solo la empresa (admin) o otro director.
    // Si el código no existe o pertenece a otro rol, se asigna a la empresa.
    let inviter = null;
    if (ref) {
        inviter = await User.findOne({ sellerCode: String(ref).trim(), role: { $in: ['admin', 'director'] } });
    }
    if (!inviter) inviter = await User.findOne({ role: 'admin' });

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
        referredBy: inviter ? inviter._id : null,
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

// Directores recomendados por el director, cada uno con el tamaño de su equipo
async function getDirectorDirectors(User, directorId) {
    const directors = await User.find({ referredBy: directorId, role: 'director' })
        .select('name lastName email country sellerCode createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const counts = await User.aggregate([
        { $match: { referredBy: { $in: directors.map(d => d._id) }, role: { $in: ['vendedor', 'user', 'director'] } } },
        { $group: { _id: { by: '$referredBy', role: '$role' }, n: { $sum: 1 } } }
    ]);
    const get = (id, role) => (counts.find(c => String(c._id.by) === String(id) && c._id.role === role) || {}).n || 0;
    return directors.map(d => ({
        ...d,
        sellersCount: get(d._id, 'vendedor'),
        clientsCount: get(d._id, 'user'),
        directorsCount: get(d._id, 'director')
    }));
}

module.exports = {
    DIRECTOR_CONTRACT_VERSION,
    registerDirector,
    getDirectorTeam,
    getDirectorDirectors
};
