const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const https = require('https');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';
const IZIPAY_CLIENT_KEY = process.env.IZIPAY_CLIENT_KEY; // Password de API REST

// ── Membership model ─────────────────────────────────────────────
let Membership;
if (mongoose.models.Membership) {
    Membership = mongoose.model('Membership');
} else {
    const schema = new mongoose.Schema({
        name: String,
        price: Number,
        currency: String,
    });
    Membership = mongoose.model('Membership', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const decoded = verifyToken(req);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    try {
        await connectDB();
        const { membershipId } = req.body;
        
        if (!membershipId) {
            return res.status(400).json({ success: false, message: 'ID de membresía requerido' });
        }

        const membership = await Membership.findById(membershipId);
        if (!membership) {
            return res.status(404).json({ success: false, message: 'Membresía no encontrada' });
        }

        // Configuración para Izipay
        // El precio debe estar en centavos (ej: 10.00 -> 1000)
        const amount = Math.round(membership.price * 100);
        const orderId = `ORDER-${Date.now()}-${decoded.id.slice(-4)}`;

        const postData = JSON.stringify({
            amount: amount,
            currency: membership.currency || 'PEN',
            orderId: orderId,
            customer: {
                email: decoded.email
            }
        });

        // Autenticación Basic: ShopID:Password
        const authHeader = 'Basic ' + Buffer.from(`${process.env.IZIPAY_SHOP_ID}:${IZIPAY_CLIENT_KEY}`).toString('base64');

        const options = {
            hostname: 'api.micuentaweb.pe',
            port: 443,
            path: '/api-payment/V4/Charge/CreatePayment',
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const iziRes = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => resolve(JSON.parse(data)));
            });
            request.on('error', (err) => reject(err));
            request.write(postData);
            request.end();
        });

        if (iziRes.status === 'SUCCESS') {
            return res.json({
                success: true,
                formToken: iziRes.answer.formToken
            });
        } else {
            console.error('Izipay Error:', iziRes);
            return res.status(500).json({
                success: false,
                message: 'Error al generar token de pago',
                error: iziRes.errorMessage
            });
        }

    } catch (error) {
        console.error('Checkout Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
