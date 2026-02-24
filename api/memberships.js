const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// ── Membership model ─────────────────────────────────────────────
let Membership;
try { Membership = mongoose.model('Membership'); } catch {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        price: { type: Number, required: true, min: 0 },
        durationDays: { type: Number, required: true, default: 30 },
        badge: { type: String, default: '' },
        color: { type: String, default: '#7C3AED' },
        features: [{ type: String }],
        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    Membership = mongoose.model('Membership', schema);
}

// ── User model ───────────────────────────────────────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name: String, email: String, password: String,
        role: { type: String, default: 'user' },
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    schema.methods.hasMembership = function () {
        return !!(this.activeMembership && this.membershipExpiresAt && new Date() < this.membershipExpiresAt);
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
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const url = req.url.split('?')[0];

    // ── GET /api/memberships (public) ────────────────────────────
    if (req.method === 'GET' && (url === '/api/memberships' || url.endsWith('/memberships'))) {
        const memberships = await Membership.find({ isActive: true }).sort({ order: 1, price: 1 });
        return res.json({ success: true, memberships });
    }

    // ── POST /api/memberships/subscribe ─────────────────────────
    if (req.method === 'POST' && url.endsWith('/subscribe')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autenticado' });
        const { membershipId } = req.body;
        if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });
        const membership = await Membership.findById(membershipId);
        if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        let expiresAt;
        if (!membership.durationDays || membership.durationDays === 0) {
            expiresAt = new Date('2099-12-31');
        } else {
            expiresAt = new Date(Date.now() + membership.durationDays * 24 * 60 * 60 * 1000);
        }
        user.activeMembership = membership._id;
        user.membershipExpiresAt = expiresAt;
        user.membershipPlan = membership.name;
        user.updatedAt = Date.now();
        await user.save();

        return res.json({ success: true, message: 'Membresía activada', membership: { name: membership.name, expiresAt } });
    }

    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};
