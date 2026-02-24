const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// ── User model (inline para Vercel serverless) ──────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
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

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error', error: err.message });
    }

    const url = req.url.split('?')[0];

    // ── POST /api/auth/register ──────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/register')) {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });
        const user = new User({ name, email, password });
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true, token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, hasMembership: false }
        });
    }

    // ── POST /api/auth/login ─────────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/login')) {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        const hasMem = user.hasMembership();
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true, token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, hasMembership: hasMem, membershipPlan: user.membershipPlan }
        });
    }

    // ── GET /api/auth/me ─────────────────────────────────────────
    if (req.method === 'GET' && url.endsWith('/me')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Token inválido' });
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return res.json({ success: true, user: { ...user.toObject(), hasMembership: user.hasMembership() } });
    }

    // ── GET /api/auth/check-access ───────────────────────────────
    if (req.method === 'GET' && url.endsWith('/check-access')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autenticado' });
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        const hasMem = user.hasMembership();
        const hasAccess = hasMem || user.role === 'admin';
        return res.json({ success: true, hasAccess, hasMembership: hasMem, membershipPlan: user.membershipPlan, role: user.role });
    }

    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};
