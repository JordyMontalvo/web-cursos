const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';
const IZIPAY_CLIENT_KEY = process.env.IZIPAY_CLIENT_KEY;

// ── Models ──────────────────────────────────────────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name: String, email: String,
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
        membershipExpiresAt: Date,
        membershipPlan: String,
        updatedAt: { type: Date, default: Date.now }
    });
    User = mongoose.model('User', schema);
}

let Membership;
try { Membership = mongoose.model('Membership'); } catch {
    const schema = new mongoose.Schema({
        name: String,
        price: Number,
        currency: String,
        durationDays: { type: Number, default: 30 }
    });
    Membership = mongoose.model('Membership', schema);
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function verifyHash(answer, hash, key) {
    const calculatedHash = crypto.createHmac('sha256', key).update(answer).digest('hex');
    return calculatedHash === hash;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.url.split('?')[0];

    // ── POST /api/izipay (Checkout) ──────────────────────────────────
    if (req.method === 'POST' && (url.endsWith('/checkout') || !req.body['kr-answer'])) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autorizado' });

        try {
            await connectDB();
            const { membershipId } = req.body;
            if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

            const membership = await Membership.findById(membershipId);
            if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

            const amount = Math.round(membership.price * 100);
            const orderId = `USR_${decoded.id}_MEM_${membershipId}_${Date.now()}`;

            const postData = JSON.stringify({
                amount: amount,
                currency: membership.currency || 'PEN',
                orderId: orderId,
                customer: { email: decoded.email }
            });

            const authHeader = 'Basic ' + Buffer.from(`${process.env.IZIPAY_SHOP_ID}:${IZIPAY_CLIENT_KEY}`).toString('base64');
            const options = {
                hostname: 'api.micuentaweb.pe',
                port: 443,
                path: '/api-payment/V4/Charge/CreatePayment',
                method: 'POST',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Content-Length': postData.length }
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
                return res.json({ success: true, formToken: iziRes.answer.formToken });
            } else {
                return res.status(500).json({ success: false, message: 'Error de Izipay', error: iziRes.errorMessage });
            }
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── POST /api/izipay (Webhook) ────────────────────────────────────
    if (req.method === 'POST' && req.body['kr-answer']) {
        const { "kr-answer": krAnswer, "kr-hash": krHash } = req.body;
        const hmacKey = process.env.IZIPAY_HMAC_SHA256;
        if (!hmacKey) return res.status(500).send('HMAC key missing');

        const answerStr = (typeof krAnswer === 'string') ? krAnswer : JSON.stringify(krAnswer);
        if (!verifyHash(answerStr, krHash, hmacKey)) return res.status(401).send('Invalid hash');

        const answer = JSON.parse(answerStr);
        if (answer.orderStatus !== 'PAID') return res.status(200).send('Not paid');

        try {
            await connectDB();
            const parts = answer.orderDetails.orderId.split('_');
            const userId = parts[1], membershipId = parts[3];

            const user = await User.findById(userId);
            const membership = await Membership.findById(membershipId);
            if (!user || !membership) throw new Error('Not found');

            const expiresAt = (!membership.durationDays || membership.durationDays === 0) 
                ? new Date('2099-12-31') 
                : new Date(Date.now() + membership.durationDays * 24 * 60 * 60 * 1000);

            user.activeMembership = membership._id;
            user.membershipExpiresAt = expiresAt;
            user.membershipPlan = membership.name;
            user.updatedAt = new Date();
            await user.save();

            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).send(err.message);
        }
    }

    return res.status(404).end();
};
