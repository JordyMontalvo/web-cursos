const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET env var not set'); })();

let Banner;
if (mongoose.models.Banner) {
    Banner = mongoose.model('Banner');
} else {
    const schema = new mongoose.Schema({
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        imageUrl: { type: String, required: true },
        linkUrl: { type: String, default: '' },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    Banner = mongoose.model('Banner', schema);
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

    const id = req.query.id || null;

    // GET /api/admin/banners
    if (req.method === 'GET') {
        const banners = await Banner.find().sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // POST /api/admin/banners
    if (req.method === 'POST') {
        const { title, subtitle, imageUrl, linkUrl, order, isActive } = req.body;
        if (!imageUrl) return res.status(400).json({ success: false, message: 'La URL de imagen es requerida' });
        const banner = new Banner({
            title: title || '', subtitle: subtitle || '',
            imageUrl, linkUrl: linkUrl || '',
            order: Number(order) || 0,
            isActive: isActive !== false
        });
        await banner.save();
        return res.json({ success: true, banner });
    }

    // PUT /api/admin/banners/:id
    if (req.method === 'PUT' && id) {
        const { title, subtitle, imageUrl, linkUrl, order, isActive } = req.body;
        const updateData = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = title;
        if (subtitle !== undefined) updateData.subtitle = subtitle;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
        if (order !== undefined) updateData.order = Number(order);
        if (isActive !== undefined) updateData.isActive = isActive;

        const banner = await Banner.findByIdAndUpdate(id, updateData, { new: true });
        if (!banner) return res.status(404).json({ success: false, message: 'Banner no encontrado' });
        return res.json({ success: true, banner });
    }

    // DELETE /api/admin/banners/:id
    if (req.method === 'DELETE' && id) {
        await Banner.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Banner eliminado' });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
