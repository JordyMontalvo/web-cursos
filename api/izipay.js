const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');

const JWT_SECRET = (process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024').trim();
const IZIPAY_SHOP_ID = process.env.IZIPAY_SHOP_ID || '57935063';
const IZIPAY_TEST_KEY = process.env.IZIPAY_TEST_KEY || 'testpassword_DWeSvCxTjoB8Shejukp5cXJb8ylevIdvRUOGj93Bh62aS';
const IZIPAY_HMAC_KEY = process.env.IZIPAY_HMAC_SHA256 || 'EQeRVnjIJjzgPtuFCvrdUTyIfKPyO1zl84VCBfPfvTbek';
const IZIPAY_CLIENT_KEY_RAW = IZIPAY_TEST_KEY;

// Función para normalizar el Shop ID a 8 dígitos (Izipay es estricto)
function normalizeShopId(id) {
    if (!id) return null;
    let clean = id.toString().trim();
    if (clean.length > 8 && clean.startsWith('0')) clean = clean.slice(1); // Quitar cero si sobra
    while (clean.length < 8) clean = '0' + clean; // Añadir ceros si falta
    return clean;
}

// Función para llamar a Izipay con una clave específica
async function callIzipay(postData, shopId, key, endpoint = 'api.micuentaweb.pe', customPath = null) {
    const apiPath = customPath || '/api-payment/V4/Charge/CreatePayment';
    const cleanId = shopId.toString().trim();
    const cleanKey = key.toString().trim();
    const authHeader = 'Basic ' + Buffer.from(`${cleanId}:${cleanKey}`).toString('base64');
    
    // Extraemos ctx_mode del postData para las cabeceras
    let mode = 'PRODUCTION';
    try { mode = JSON.parse(postData).ctx_mode || 'PRODUCTION'; } catch(e) {}

    const options = {
        hostname: endpoint,
        port: 443,
        path: apiPath,
        method: 'POST',
        headers: { 
            'Authorization': authHeader, 
            'Content-Type': 'application/json; charset=utf-8', 
            'Accept': 'application/json',
            'X-Shop-Id': cleanId,
            'X-Ctx-Mode': mode,
            'User-Agent': 'Izipay-Node-Client/2.0'
        }
    };

    const postDataBuffer = Buffer.from(postData);
    options.headers['Content-Length'] = postDataBuffer.length;

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            console.log(`[IZIPAY] HTTP Status: ${response.statusCode} | Shop=${shopId}`);
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({ status: 'ERROR', errorMessage: 'Invalid JSON from Izipay' }); }
            });
        });
        request.on('error', (err) => reject(err));
        request.write(postData);
        request.end();
    });
}

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
    console.log(`[IZIPAY] Request URL: ${url} | Method: ${req.method}`);

    // ── POST /api/izipay (Checkout) ──────────────────────────────────
    if (req.method === 'POST' && (url.includes('/checkout') || !req.body?.['kr-answer'])) {
        const decoded = verifyToken(req);
        if (!decoded) {
            console.warn('[IZIPAY] Unauthorized attempt');
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        try {
            console.log(`[IZIPAY] Starting checkout for memberId: ${req.body?.membershipId}`);
            
            // ANALÍSIS DE CREDENCIALES (Hexadecimal)
            const idHex = Buffer.from(IZIPAY_SHOP_ID).toString('hex');
            const keyHex = Buffer.from(IZIPAY_CLIENT_KEY_RAW.slice(0, 15)).toString('hex');
            console.log(`[IZIPAY] DIAGNOSTIC: ShopID="${IZIPAY_SHOP_ID}" (Hex:${idHex}) | KeyLen=${IZIPAY_CLIENT_KEY_RAW.length} (Hex_15:${keyHex})`);
            
            await connectDB();
            const { membershipId } = req.body;
            if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

            const membership = await Membership.findById(membershipId);
            if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

            const amount = Math.round(membership.price * 100);
            
            // ORDER_ID: Acortado para máxima compatibilidad
            const orderId = `TEST_${Date.now().toString().slice(-6)}_${membershipId.slice(-4)}`;
            
            const basePostData = {
                amount: amount,
                currency: 'PEN', // Forzamos PEN para evitar PSP_610 en cuentas de Perú que no tengan multidivisa
                orderId: orderId,
                customer: { 
                    email: decoded.email || 'customer@example.com',
                    reference: decoded.id
                }
            };

            // MODO TEST FORZADO
            const mode = 'TEST';
            const sId = normalizeShopId(IZIPAY_SHOP_ID);
            const key = IZIPAY_TEST_KEY;

            const finalBody = { 
                ...basePostData, 
                ctx_mode: mode 
            };

            const finalPostData = JSON.stringify(finalBody);

            console.log(`[IZIPAY] SENDING TO API: Path=/api-payment/V4/Charge/CreatePayment | Mode=${mode} | Shop=${sId}`);
            console.log(`[IZIPAY] BODY: ${finalPostData}`);
            
            iziRes = await callIzipay(finalPostData, sId, key, 'api.micuentaweb.pe', '/api-payment/V4/Charge/CreatePayment');


            if (iziRes.status === 'SUCCESS') {
                console.log('[IZIPAY] Checkout SUCCESS');
                return res.json({ success: true, formToken: iziRes.answer.formToken });
            } else {
                console.error('[IZIPAY] Izipay API Final Error Response:', iziRes);
                return res.status(500).json({ success: false, message: 'Error de Izipay', error: iziRes.errorMessage });
            }
        } catch (err) {
            console.error('[IZIPAY] Internal Checkout Error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── POST /api/izipay (Webhook) ────────────────────────────────────
    if (req.method === 'POST' && req.body['kr-answer']) {
        const { "kr-answer": krAnswer, "kr-hash": krHash } = req.body;
        const hmacKey = IZIPAY_HMAC_KEY;
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
