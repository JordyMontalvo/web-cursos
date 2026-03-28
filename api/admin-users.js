const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

let User;
if (mongoose.models.User) {
    User = mongoose.model('User');
} else {
    const schema = new mongoose.Schema({
        name: String, 
        lastName: String,
        email: String, 
        password: String,
        phone: String,
        country: String,
        birthDate: String,
        role: { type: String, default: 'user' },
        sellerCode: { type: String, unique: true, sparse: true }, // Removed default: null to allow sparse index to work
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan: { type: String, default: null },
        progress:            { type: Object, default: {} },
        permissions:         { type: [String], default: [] },
        canCreate:           { type: Boolean, default: true },
        canEdit:             { type: Boolean, default: true },
        createdAt:   { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });

    schema.pre('save', async function () {
        if (!this.isModified('password')) return;
        this.password = await bcrypt.hash(this.password, 12);
        this.updatedAt = Date.now();
    });

    User = mongoose.model('User', schema);
}

let Membership;
// ... (Membership model remains same)
if (mongoose.models.Membership) {
    Membership = mongoose.model('Membership');
} else {
    const schema = new mongoose.Schema({
        name: String, price: Number, currency: String, durationDays: Number
    });
    Membership = mongoose.model('Membership', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyAdmin(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try {
        const d = jwt.verify(token, JWT_SECRET);
        return d.role === 'admin' ? d : null;
    } catch { return null; }
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error', error: err.message });
    }

    const url = req.url.split('?')[0];
    const parts = url.split('/').filter(Boolean);
    const userId = req.query.id || (parts.length >= 4 ? parts[3] : null);
    const isMembershipAction = req.query.membership === 'true' || parts[parts.length - 1] === 'membership';

    try {
        // GET /api/admin/users
        if (req.method === 'GET') {
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            return res.json({ success: true, users });
        }

        // POST /api/admin/users
        if (req.method === 'POST') {
            const { name, lastName, email, phone, country, password, role, sellerCode, permissions, canCreate, canEdit } = req.body;
            
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
            }

            // Autogenerar sellerCode si el rol es vendedor y no se proporcionó uno
            let finalSellerCode = undefined;
            if (role === 'vendedor') {
                if (sellerCode && sellerCode.trim()) {
                    // Usar el código proporcionado por el admin
                    finalSellerCode = sellerCode.trim().toUpperCase();
                } else {
                    // Autogenerar: primeras 5 letras del nombre + 4 chars aleatorios
                    const nameBase = name.replace(/\s+/g, '').toUpperCase().slice(0, 5);
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    let generated;
                    let attempts = 0;
                    do {
                        const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                        generated = `${nameBase}-${rand}`;
                        attempts++;
                    } while (await User.findOne({ sellerCode: generated }) && attempts < 10);
                    finalSellerCode = generated;
                }
                // Verificar que el código no esté ya en uso
                const codeExists = await User.findOne({ sellerCode: finalSellerCode });
                if (codeExists) {
                    return res.status(400).json({ success: false, message: `El código de vendedor "${finalSellerCode}" ya está en uso` });
                }
            }

            const user = new User({
                name,
                lastName,
                email,
                phone,
                country,
                password,
                role: role || 'user',
                sellerCode: finalSellerCode,
                permissions: permissions || [],
                canCreate: canCreate !== undefined ? canCreate : true,
                canEdit: canEdit !== undefined ? canEdit : true
            });

            await user.save();
            return res.json({ success: true, message: 'Usuario creado exitosamente', userId: user._id, sellerCode: finalSellerCode });
        }

        // PUT /api/admin/users/:id
        if (req.method === 'PUT' && userId) {
            // Handle password update separately or in general PUT
            if (isMembershipAction) {
                const { membershipId, action } = req.body;

                if (action === 'revoke') {
                    await User.findByIdAndUpdate(userId, {
                        activeMembership: null,
                        membershipExpiresAt: null,
                        membershipPlan: null,
                        updatedAt: Date.now()
                    });
                    return res.json({ success: true, message: 'Membresía revocada' });
                }

                if (!membershipId) return res.status(400).json({ success: false, message: 'membershipId requerido' });
                const membership = await Membership.findById(membershipId);
                if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

                let expiresAt;
                if (!membership.durationDays || membership.durationDays === 0) {
                    expiresAt = new Date('2099-12-31');
                } else {
                    expiresAt = new Date(Date.now() + membership.durationDays * 24 * 60 * 60 * 1000);
                }

                await User.findByIdAndUpdate(userId, {
                    activeMembership: membership._id,
                    membershipExpiresAt: expiresAt,
                    membershipPlan: membership.name,
                    updatedAt: Date.now()
                });
                return res.json({ success: true, message: 'Membresía asignada' });
            } else {
                // General Update (Password, Role, Permissions, sellerCommission, etc)
                const { password, role, permissions, canCreate, canEdit, sellerCommission, sellerCode } = req.body;
                const updateData = {};
                if (password) {
                    const user = await User.findById(userId);
                    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
                    user.password = password;
                    await user.save();
                    return res.json({ success: true, message: 'Contraseña actualizada con éxito' });
                }

                if (role) updateData.role = role;
                if (permissions) updateData.permissions = permissions;
                if (canCreate !== undefined) updateData.canCreate = canCreate;
                if (canEdit !== undefined) updateData.canEdit = canEdit;

                // Campos exclusivos de vendedor
                if (sellerCommission !== undefined && sellerCommission !== null) {
                    updateData.sellerCommission = Number(sellerCommission);
                }
                if (sellerCode !== undefined) {
                    // Validar que el código no esté en uso por otro usuario
                    if (sellerCode && sellerCode.trim()) {
                        const codeInUse = await User.findOne({ sellerCode: sellerCode.trim().toUpperCase(), _id: { $ne: userId } });
                        if (codeInUse) return res.status(400).json({ success: false, message: `El código "${sellerCode}" ya está en uso` });
                        updateData.sellerCode = sellerCode.trim().toUpperCase();
                    } else {
                        updateData.$unset = { sellerCode: '' };
                    }
                }

                if (Object.keys(updateData).length > 0 || updateData.$unset) {
                    await User.findByIdAndUpdate(userId, { ...updateData, updatedAt: Date.now() });
                    return res.json({ success: true, message: 'Usuario actualizado con éxito' });
                }

                return res.status(400).json({ success: false, message: 'Datos insuficientes para la actualización' });
            }
        }

        return res.status(405).json({ success: false, message: 'Método no permitido' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
};
