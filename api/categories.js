const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

let Category;
try { Category = mongoose.model('Category'); } catch {
    const schema = new mongoose.Schema({
        name: { type: String, required: true, unique: true, trim: true },
        createdAt: { type: Date, default: Date.now }
    });
    Category = mongoose.model('Category', schema);
}

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
    // Determine if it's an admin request based on the URL or presence of Auth header
    const url = req.url.split('?')[0];
    const isAdminPath = url.includes('/admin/');
    
    if (isAdminPath || req.method !== 'GET') {
        setCORS(res, 'GET, POST, PUT, DELETE, OPTIONS');
    } else {
        setCORS(res, 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const id = req.query.id;

    // Public GET
    if (req.method === 'GET' && !isAdminPath) {
        try {
            const categories = await Category.find().sort({ name: 1 });
            return res.json({ success: true, categories });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error', error: error.message });
        }
    }

    // Admin endpoints
    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    // Admin GET
    if (req.method === 'GET' && isAdminPath) {
        const categories = await Category.find().sort({ name: 1 });
        return res.json({ success: true, categories });
    }

    // Admin POST
    if (req.method === 'POST') {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nombre requerido' });
        
        const existing = await Category.findOne({ name: name.toUpperCase() });
        if (existing) return res.status(400).json({ success: false, message: 'La categoría ya existe' });

        const cat = new Category({ name: name.toUpperCase() });
        await cat.save();
        return res.json({ success: true, category: cat });
    }

    // Admin PUT
    if (req.method === 'PUT' && id) {
        const { name } = req.body;
        const updateData = {};
        if (name) updateData.name = name.toUpperCase();

        const cat = await Category.findByIdAndUpdate(id, updateData, { new: true });
        if (!cat) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
        return res.json({ success: true, category: cat });
    }

    // Admin DELETE
    if (req.method === 'DELETE' && id) {
        await Category.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Categoría eliminada' });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
