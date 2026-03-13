const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// ── User model (inline para Vercel serverless) ──────────────────
let User;
if (mongoose.models.User) {
    User = mongoose.model('User');
} else {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        lastName: { type: String, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        phone: { type: String, default: '' },
        country: { type: String, default: '' },
        city: { type: String, default: '' },
        birthDate: { type: String, default: '' },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    schema.pre('save', async function () {
        if (!this.isModified('password')) return;
        this.password = await bcrypt.hash(this.password, 12);
        this.updatedAt = Date.now();
    });
    schema.methods.comparePassword = async function (p) {
        return bcrypt.compare(p, this.password);
    };
    schema.methods.hasMembership = function () {
        if (!this.activeMembership || !this.membershipExpiresAt) return false;
        return new Date() < this.membershipExpiresAt;
    };
    User = mongoose.model('User', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

/**
 * Parsea el body de la request de forma robusta para Vercel.
 */
async function parseBody(req) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch { return {}; }
    }
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

module.exports = async (req, res) => {
    setCORS(res);
    const { method, url } = req;
    if (method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error de conexión a la base de datos' });
    }

    // ── POST /api/auth/register ──────────────────────────────────
    if (method === 'POST' && url.endsWith('/register')) {
        const body = await parseBody(req);
        const { name, email, password, phone } = body;
        
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        
        const adminEmail = 'admin@iatibet.com';
        if (email.toLowerCase() === adminEmail) {
            return res.status(403).json({ success: false, message: 'Este correo está reservado' });
        }

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });
        
        const user = new User({ name, email, password, phone: phone || '' });
        await user.save();
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true, token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                phone: user.phone,
                role: user.role, 
                hasMembership: false 
            }
        });
    }

    // ── POST /api/auth/login ─────────────────────────────────────
    if (method === 'POST' && url.endsWith('/login')) {
        const body = await parseBody(req);
        const { email, password } = body;
        
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true, token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                phone: user.phone,
                role: user.role, 
                hasMembership: user.hasMembership() 
            }
        });
    }

    // ── GET /api/auth/me ─────────────────────────────────────────
    if (method === 'GET' && url.endsWith('/me')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Token inválido' });
        
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ success: true, user: { ...user.toObject(), hasMembership: user.hasMembership() } });
    }

    // ── PUT /api/auth/me ─────────────────────────────────────────
    if (method === 'PUT' && url.endsWith('/me')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autorizado' });

        const body = await parseBody(req);
        const { name, lastName, country, city, phone, birthDate, currentPassword, newPassword } = body;

        try {
            const user = await User.findById(decoded.id);
            if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

            // Si intenta cambiar password
            if (currentPassword && newPassword) {
                const isMatch = await user.comparePassword(currentPassword);
                if (!isMatch) return res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta' });
                user.password = newPassword;
            }

            // Campos de perfil
            if (name !== undefined) user.name = name;
            if (lastName !== undefined) user.lastName = lastName;
            if (country !== undefined) user.country = country;
            if (city !== undefined) user.city = city;
            if (phone !== undefined) user.phone = phone;
            if (birthDate !== undefined) user.birthDate = birthDate;

            user.updatedAt = Date.now();
            await user.save();

            const updatedUser = user.toObject();
            delete updatedUser.password;

            return res.json({ 
                success: true, 
                message: 'Perfil actualizado', 
                user: { ...updatedUser, hasMembership: user.hasMembership() } 
            });
        } catch (err) {
            console.error('[Auth.me PUT] error:', err);
            return res.status(500).json({ success: false, message: 'Error al actualizar perfil' });
        }
    }

    // ── GET /api/auth/check-access ───────────────────────────────
    if (method === 'GET' && url.endsWith('/check-access')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autenticado' });
        
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        
        const hasMem = user.hasMembership();
        const hasAccess = hasMem || user.role === 'admin';
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ 
            success: true, 
            hasAccess, 
            hasMembership: hasMem, 
            membershipPlan: user.membershipPlan, 
            role: user.role 
        });
    }

    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};
