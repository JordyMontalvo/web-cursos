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

/**
 * Parsea el body de la request de forma robusta.
 * En Vercel, req.body puede venir ya parseado (JSON), como string, o como Buffer.
 */
async function parseBody(req) {
    // Caso 1: ya está parseado (objeto)
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        return req.body;
    }
    // Caso 2: es un string JSON
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch { return {}; }
    }
    // Caso 3: no hay body o es Buffer — leer del stream
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const admin = verifyAdmin(req);
    if (!admin) {
        return res.status(403).json({ success: false, message: 'Acceso denegado' });
    }

    try {
        await connectDB();
    } catch (err) {
        console.error('[AdminSettings] DB connection error:', err.message);
        return res.status(500).json({ success: false, message: 'Error de conexión a la base de datos', error: err.message });
    }

    // GET /api/admin/settings
    if (req.method === 'GET') {
        try {
            let settings = await Settings.findOne();
            if (!settings) settings = await Settings.create({});
            return res.json({ success: true, settings });
        } catch (err) {
            console.error('[AdminSettings] GET error:', err.message);
            return res.status(500).json({ success: false, message: 'Error al obtener configuración', error: err.message });
        }
    }

    // PUT /api/admin/settings
    if (req.method === 'PUT') {
        try {
            const body = await parseBody(req);
            const { presentationVideoUrl, companyName, logoUrl } = body;

            console.log('[AdminSettings] PUT body keys:', Object.keys(body));
            console.log('[AdminSettings] companyName:', companyName);

            let settings = await Settings.findOne();
            if (!settings) {
                settings = new Settings();
            }

            if (presentationVideoUrl !== undefined) settings.presentationVideoUrl = presentationVideoUrl;
            if (companyName !== undefined) settings.companyName = companyName;
            if (logoUrl !== undefined) settings.logoUrl = logoUrl;

            settings.updatedAt = new Date();

            // Usar findOneAndUpdate para mayor confiabilidad en entornos serverless
            const updated = await Settings.findOneAndUpdate(
                { _id: settings._id || undefined },
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

            console.log('[AdminSettings] Saved companyName:', updated.companyName);
            return res.json({ success: true, settings: updated });
        } catch (err) {
            console.error('[AdminSettings] PUT error:', err.message);
            return res.status(500).json({ success: false, message: 'Error al guardar configuración', error: err.message });
        }
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
