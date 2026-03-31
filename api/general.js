const { connectDB } = require('../lib/db');
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

const LandingConfig = mongoose.models.LandingConfig || mongoose.model('LandingConfig', new mongoose.Schema({
    featuresTitle: String,
    featuresSubtitle: String,
    features: [{ icon: String, title: String, description: String }],
    faqTitle: String,
    faqSubtitle: String,
    faqs: [{ question: String, answer: String }],
    guaranteeTitle: String,
    guaranteeDescription: String,
    guaranteeIcon: String,
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
    const route = req.query?.route;
    
    if (isAdminPath || req.method !== 'GET') {
        setCORS(res, 'GET, POST, PUT, DELETE, OPTIONS');
    } else {
        setCORS(res, 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) { 
        console.error('DB Connection Error:', err);
        return res.status(500).json({ success: false, message: 'Error de conexión a base de datos' }); 
    }

    try {

    // ── PUBLIC: /api/config ────────────────────────────────────────────────
    if (route === 'config' || (url.includes('config') && !route)) {
        const testPubKey = '38106701:testpublickey_XdWqqaCVK27gEgKSYJOEofci1FL6eAs4MxpWzSWZwInIh';
        return res.json({
            apiUrl: process.env.BACKEND_URL || '',
            izipayPublicKey: testPubKey,
            izipayShopId: '38106701'
        });
    }

    // ── PUBLIC: /api/banners ───────────────────────────────────────────────
    if (route === 'public-banners' || (url.includes('banners') && !isAdminPath && !route)) {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // ── PUBLIC: /api/settings ──────────────────────────────────────────────
    if (route === 'public-settings' || (url.includes('settings') && !isAdminPath && !route)) {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── PUBLIC: /api/landing-config ─────────────────────────────────────────
    if (route === 'public-landing-config' || (url.includes('landing-config') && !isAdminPath && !route)) {
        let config = await LandingConfig.findOne() || await LandingConfig.create({});
        return res.json({ success: true, config });
    }

    // ── ADMIN: Authentication required ──
    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    // ── ADMIN: /api/admin/settings (GET) ──
    if (route === 'admin-settings' && req.method === 'GET') {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── ADMIN: /api/admin/settings (PUT) ──
    if (route === 'admin-settings' && req.method === 'PUT') {
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

    // ── ADMIN: /api/admin/landing-config (PUT) ──
    if ((route === 'admin-landing-config' && req.method === 'PUT') || (url.includes('landing-config') && req.method === 'PUT' && !route)) {
        const {
            featuresTitle, featuresSubtitle, features,
            faqTitle, faqSubtitle, faqs,
            guaranteeTitle, guaranteeDescription, guaranteeIcon
        } = req.body;

        const updated = await LandingConfig.findOneAndUpdate(
            {},
            {
                $set: {
                    ...(featuresTitle !== undefined && { featuresTitle }),
                    ...(featuresSubtitle !== undefined && { featuresSubtitle }),
                    ...(features !== undefined && { features }),
                    ...(faqTitle !== undefined && { faqTitle }),
                    ...(faqSubtitle !== undefined && { faqSubtitle }),
                    ...(faqs !== undefined && { faqs }),
                    ...(guaranteeTitle !== undefined && { guaranteeTitle }),
                    ...(guaranteeDescription !== undefined && { guaranteeDescription }),
                    ...(guaranteeIcon !== undefined && { guaranteeIcon }),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        return res.json({ success: true, config: updated });
    }

    return res.status(404).end();
    } catch (error) {
        console.error('API Error in general.js:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};
