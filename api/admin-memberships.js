const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

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
    // Extract id from URL like /api/admin/memberships/123
    const parts = url.split('/');
    const id = parts[parts.length - 1] !== 'memberships' ? parts[parts.length - 1] : null;

    // GET /api/admin/memberships
    if (req.method === 'GET') {
        const memberships = await Membership.find().sort({ order: 1, price: 1 });
        return res.json({ success: true, memberships });
    }

    // POST /api/admin/memberships
    if (req.method === 'POST') {
        const { name, description, price, durationDays, badge, color, features, isActive, order } = req.body;
        if (!name || price === undefined) return res.status(400).json({ success: false, message: 'Nombre y precio requeridos' });
        const m = new Membership({ name, description, price, durationDays: durationDays || 30, badge, color, features: features || [], isActive: isActive !== false, order: order || 0 });
        await m.save();
        return res.json({ success: true, membership: m });
    }

    // PUT /api/admin/memberships/:id
    if (req.method === 'PUT' && id) {
        const { name, description, price, durationDays, badge, color, features, isActive, order } = req.body;
        const m = await Membership.findByIdAndUpdate(id, { name, description, price, durationDays, badge, color, features, isActive, order, updatedAt: Date.now() }, { new: true });
        if (!m) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        return res.json({ success: true, membership: m });
    }

    // DELETE /api/admin/memberships/:id
    if (req.method === 'DELETE' && id) {
        await Membership.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Plan eliminado' });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
