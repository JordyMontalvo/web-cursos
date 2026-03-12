const { connectDB } = require('./_db');
const mongoose = require('mongoose');

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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    if (req.method === 'GET') {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        return res.json({ success: true, settings });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
