const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET env var not set'); })();

let Membership;
try { Membership = mongoose.model('Membership'); } catch {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        planType: { type: String, enum: ['mensual', 'anual', 'trianual'] },
        description: { type: String, default: '' },
        price: { type: Number, required: true, min: 0 },
        currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' },
        durationDays: { type: Number, required: true, default: 30 },
        badge: { type: String, default: '' },
        icon: { type: String, default: '🚀' },
        color: { type: String, default: '#7C3AED' },
        buttonColor: { type: String, default: '#7C3AED' },
        features: [{ type: String }],
        isActive: { type: Boolean, default: true },
        sellerCommission: { type: Number, default: 0 },
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
    const parts = url.split('/').filter(Boolean);

    // Improved ID extraction
    let id = req.query.id;
    if (!id) {
        id = parts[parts.length - 1];
        if (id === 'memberships' || id === 'admin-memberships') id = null;
    }

    console.log(`[AdminMemberships] ${req.method} ${req.url} | ID extracted: ${id}`);

    // GET /api/admin/memberships
    if (req.method === 'GET') {
        const orderMap = { mensual: 1, anual: 2, trianual: 3 };
        const memberships = await Membership.find().sort({ order: 1, price: 1 });
        memberships.sort((a, b) => (orderMap[a.planType] || a.order || 99) - (orderMap[b.planType] || b.order || 99));
        return res.json({ success: true, memberships });
    }

    // POST /api/admin/memberships -> Deshabilitado (solo 3 planes fijos)
    if (req.method === 'POST') {
        return res.status(403).json({
            success: false,
            message: 'No está permitido crear planes adicionales. Solo existen los 3 planes fijos (Mensual, Anual y TriAnual).'
        });
    }

    // PUT /api/admin/memberships/:id
    if (req.method === 'PUT' && id) {
        const { name, description, price, currency, badge, color, buttonColor, icon, features, isActive, sellerCommission, order } = req.body;
        const updateData = { updatedAt: Date.now() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = Number(price);
        if (currency !== undefined) updateData.currency = currency;
        // durationDays y planType son fijos según las reglas de negocio
        if (badge !== undefined) updateData.badge = badge;
        if (color !== undefined) updateData.color = color;
        if (buttonColor !== undefined) updateData.buttonColor = buttonColor;
        if (icon !== undefined) updateData.icon = icon;
        if (features !== undefined) updateData.features = Array.isArray(features) ? features : [];
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sellerCommission !== undefined) updateData.sellerCommission = Number(sellerCommission);
        if (order !== undefined) updateData.order = Number(order);

        console.log(`[AdminMemberships] Updating Membership ${id} with:`, JSON.stringify(updateData));
        const m = await Membership.findByIdAndUpdate(id, updateData, { new: true });
        if (!m) {
            console.error(`[AdminMemberships] Plan not found for ID: ${id}`);
            return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        }
        return res.json({ success: true, membership: m });
    }

    // DELETE /api/admin/memberships/:id -> Deshabilitado (planes fijos no se eliminan)
    if (req.method === 'DELETE' && id) {
        return res.status(403).json({
            success: false,
            message: 'No está permitido eliminar los planes fijos (Mensual, Anual y TriAnual).'
        });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
