const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

let Settings;
if (mongoose.models.Settings) {
    Settings = mongoose.model('Settings');
} else {
    const schema = new mongoose.Schema({
        presentationVideoUrl: { type: String, default: '' },
        companyName: { type: String, default: 'IATIBET ZUREON' },
        logoUrl: { type: String, default: '' },
        updatedAt: { type: Date, default: Date.now }
    });
    Settings = mongoose.model('Settings', schema);
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
    console.log(`[AdminSettings] ${req.method} ${req.url}`);
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const admin = verifyAdmin(req);
    if (!admin) {
        console.warn('[AdminSettings] Acceso denegado: Token inválido o no proporcionado');
        return res.status(403).json({ success: false, message: 'Acceso denegado' });
    }

    try { await connectDB(); } catch (err) {
        console.error('[AdminSettings] Error connecting to DB:', err);
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    // GET /api/admin/settings
    if (req.method === 'GET') {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        return res.json({ success: true, settings });
    }

    // PUT /api/admin/settings
    if (req.method === 'PUT') {
        const { presentationVideoUrl, companyName, logoUrl } = req.body;
        console.log('[AdminSettings] Updating settings with:', { presentationVideoUrl, companyName, logoUrlSpecified: !!logoUrl });
        
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        if (presentationVideoUrl !== undefined) settings.presentationVideoUrl = presentationVideoUrl;
        if (companyName !== undefined) settings.companyName = companyName;
        if (logoUrl !== undefined) settings.logoUrl = logoUrl;

        settings.updatedAt = new Date();
        await settings.save();
        console.log('[AdminSettings] Settings updated successfully');
        return res.json({ success: true, settings });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
