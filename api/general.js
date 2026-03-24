const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// ── Models ──────────────────────────────────────────────────────
const Banner = mongoose.models.Banner || mongoose.model('Banner', new mongoose.Schema({
    title: String, subtitle: String, imageUrl: String, linkUrl: String, order: Number, isActive: Boolean
}));

const Settings = mongoose.models.Settings || mongoose.model('Settings', new mongoose.Schema({
    presentationVideoUrl: { type: String, default: '' },
    companyName: { type: String, default: 'IATIBET ZUREON' },
    logoUrl: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
}));

function setCORS(res, methods = 'GET, OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods);
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
    const url = req.url.split('?')[0];
    const isAdminPath = url.includes('/admin/');
    
    if (isAdminPath || req.method !== 'GET') {
        setCORS(res, 'GET, POST, PUT, DELETE, OPTIONS');
    } else {
        setCORS(res, 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) { return res.status(500).json({ success: false }); }

    // ── PUBLIC: /api/config ────────────────────────────────────────────────
    if (url.includes('config') || (url === '/api/general' && !isAdminPath)) {
        const testPubKey = '38106701:testpublickey_XdWqqaCVK27gEgKSYJOEofci1FL6eAs4MxpWzSWZwInIh';
        return res.json({
            apiUrl: process.env.BACKEND_URL || '',
            izipayPublicKey: testPubKey,
            izipayShopId: '38106701'
        });
    }

    // ── PUBLIC: /api/banners ───────────────────────────────────────────────
    if (url.includes('banners') && !isAdminPath) {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // ── PUBLIC: /api/settings ──────────────────────────────────────────────
    if (url.includes('settings') && !isAdminPath) {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── ADMIN: Authentication required ──
    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    // ── ADMIN: /api/admin/settings (GET) ──
    if (url.includes('settings') && req.method === 'GET') {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── ADMIN: /api/admin/settings (PUT) ──
    if (url.includes('settings') && req.method === 'PUT') {
        const { presentationVideoUrl, companyName, logoUrl } = req.body;
        
        const updated = await Settings.findOneAndUpdate(
            {},
            {
                $set: {
                    ...(companyName !== undefined && { companyName }),
                    ...(logoUrl !== undefined && { logoUrl }),
                    ...(presentationVideoUrl !== undefined && { presentationVideoUrl }),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        return res.json({ success: true, settings: updated });
    }

    return res.status(404).end();
};
