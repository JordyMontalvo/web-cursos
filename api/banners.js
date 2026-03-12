const { connectDB } = require('./_db');
const mongoose = require('mongoose');

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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    if (req.method === 'GET') {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
