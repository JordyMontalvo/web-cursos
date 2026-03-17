const { connectDB } = require('./_db');
const mongoose = require('mongoose');

// ── Models ──────────────────────────────────────────────────────
const Banner = mongoose.models.Banner || mongoose.model('Banner', new mongoose.Schema({
    title: String, subtitle: String, imageUrl: String, linkUrl: String, order: Number, isActive: Boolean
}));

const Settings = mongoose.models.Settings || mongoose.model('Settings', new mongoose.Schema({
    presentationVideoUrl: String, companyName: String, logoUrl: String
}));

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.url.split('?')[0];

    // ── /api/config ────────────────────────────────────────────────
    // Respondemos si la ruta contiene config o si es la raíz de esta función (vía rewrite)
    if (url.includes('config') || url === '/api/general') {
        const testPubKey = '38106701:testpublickey_XdWqqaCVK27gEgKSYJOEofci1FL6eAs4MxpWzSWZwInIh';
        return res.json({
            apiUrl: process.env.BACKEND_URL || '',
            izipayPublicKey: testPubKey,
            izipayShopId: '38106701'
        });
    }

    try { await connectDB(); } catch (err) { return res.status(500).json({ success: false }); }

    // ── /api/banners ───────────────────────────────────────────────
    if (url.includes('banners')) {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // ── /api/settings ──────────────────────────────────────────────
    if (url.includes('settings')) {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    return res.status(404).end();
};
