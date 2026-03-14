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
    console.log(`[GENERAL] Request URL: ${url} | Method: ${req.method}`);

    // ── /api/config ────────────────────────────────────────────────
    if (url.includes('/config')) {
        const config = {
            apiUrl: process.env.BACKEND_URL || '',
            izipayPublicKey: process.env.IZIPAY_PUBLIC_KEY || '',
            izipayShopId: process.env.IZIPAY_SHOP_ID || ''
        };
        console.log(`[GENERAL] Config served. Public Key exists: ${!!config.izipayPublicKey}`);
        return res.json(config);
    }

    try { 
        await connectDB(); 
    } catch (err) { 
        console.error('[GENERAL] DB Connection Error:', err.message);
        return res.status(500).json({ success: false, message: 'DB Connection Error' }); 
    }

    // ── /api/banners ───────────────────────────────────────────────
    if (url.endsWith('/banners')) {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // ── /api/settings ──────────────────────────────────────────────
    if (url.endsWith('/settings')) {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    return res.status(404).end();
};
