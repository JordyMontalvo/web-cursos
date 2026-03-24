const { connectDB } = require('./_db');
const mongoose = require('mongoose');

let Category;
try { Category = mongoose.model('Category'); } catch {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, unique: true, trim: true },
        createdAt: { type: Date, default: Date.now }
    });
    Category = mongoose.model('Category', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    if (req.method === 'GET') {
        try {
            const categories = await Category.find().sort({ name: 1 });
            return res.json({ success: true, categories });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error', error: error.message });
        }
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
