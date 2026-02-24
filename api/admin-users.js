const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

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
    User = mongoose.model('User', schema);
}

let Membership;
try { Membership = mongoose.model('Membership'); } catch {
    const schema = new mongoose.Schema({
        name: String, price: Number, durationDays: Number
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
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const url = req.url.split('?')[0];
    const parts = url.split('/').filter(Boolean);
    // /api/admin/users/:id/membership  → parts: [api, admin, users, :id, membership]
    // /api/admin/users                  → parts: [api, admin, users]
    const userId = parts.length >= 4 ? parts[3] : null;
    const isMembershipAction = parts[parts.length - 1] === 'membership';

    // GET /api/admin/users
    if (req.method === 'GET') {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        return res.json({ success: true, users });
    }

    // PUT /api/admin/users/:id/membership
    if (req.method === 'PUT' && userId && isMembershipAction) {
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
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
