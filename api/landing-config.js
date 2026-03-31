const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

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

function setCORS(res, methods = 'GET, PUT, OPTIONS') {
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
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) { 
        return res.status(500).json({ success: false, message: 'DB Connection Error' }); 
    }

    try {
        if (req.method === 'GET') {
            let config = await LandingConfig.findOne() || await LandingConfig.create({});
            return res.json({ success: true, config });
        }

        if (req.method === 'PUT') {
            const admin = verifyAdmin(req);
            if (!admin) return res.status(403).json({ success: false, message: 'No autorizado - Token de admin inválido' });

            const {
                featuresTitle, featuresSubtitle, features,
                faqTitle, faqSubtitle, faqs,
                guaranteeTitle, guaranteeDescription, guaranteeIcon
            } = req.body;

            const updated = await LandingConfig.findOneAndUpdate(
                {},
                {
                    $set: {
                        featuresTitle: featuresTitle || '',
                        featuresSubtitle: featuresSubtitle || '',
                        features: Array.isArray(features) ? features : [],
                        faqTitle: faqTitle || '',
                        faqSubtitle: faqSubtitle || '',
                        faqs: Array.isArray(faqs) ? faqs : [],
                        guaranteeTitle: guaranteeTitle || '',
                        guaranteeDescription: guaranteeDescription || '',
                        guaranteeIcon: guaranteeIcon || '🛡️',
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );
            return res.json({ success: true, config: updated, message: 'Guardado con éxito' });
        }

        return res.status(405).json({ success: false, message: 'Método no permitido' });
    } catch (error) {
        console.error('API Error in landing-config.js:', error);
        return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
