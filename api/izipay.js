const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');

const JWT_SECRET = (process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024').trim();
const IZIPAY_CLIENT_KEY_RAW = (process.env.IZIPAY_CLIENT_KEY || '').trim();
const IZIPAY_SHOP_ID = (process.env.IZIPAY_SHOP_ID || '').trim();

// Función para llamar a Izipay con una clave específica
async function callIzipay(postData, shopId, key) {
    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${key}`).toString('base64');
    const options = {
        hostname: 'api.micuentaweb.pe',
        port: 443,
        path: '/api-payment/V4/Charge/CreatePayment',
        method: 'POST',
        headers: { 
            'Authorization': authHeader, 
            'Content-Type': 'application/json', 
            'Accept': 'application/json',
            'User-Agent': 'Vercel-Serverless-Izipay-Integration/1.1'
        }
    };

    const postDataBuffer = Buffer.from(postData);
    options.headers['Content-Length'] = postDataBuffer.length;

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
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
            
            // LOG HEXADECIMAL (Detectar caracteres invisibles como espacios o saltos de línea)
            const keyHex = Buffer.from(IZIPAY_CLIENT_KEY_RAW.slice(0, 10)).toString('hex');
            console.log(`[IZIPAY] Creds Debug: Shop=${IZIPAY_SHOP_ID} | Key Raw Len=${IZIPAY_CLIENT_KEY_RAW.length} | Hex(10)=${keyHex}`);
            
            await connectDB();
            const { membershipId } = req.body;
            if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

            const membership = await Membership.findById(membershipId);
            if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

            const amount = Math.round(membership.price * 100);
            
            // Izipay V4 limita el orderId a 64 caracteres.
            // Usamos fragmentos para que sea único pero corto: U_[8char]_M_[8char]_[timestamp]
            const uPart = decoded.id.slice(-8);
            const mPart = membershipId.toString().slice(-8);
            const orderId = `U_${uPart}_M_${mPart}_${Date.now()}`;

            console.log(`[IZIPAY] orderId generado: ${orderId} (Length: ${orderId.length})`);

            const postData = JSON.stringify({
                amount: amount,
                currency: membership.currency || 'PEN',
                orderId: orderId,
                customer: { email: decoded.email }
                // ctx_mode eliminado para que el servidor de Izipay lo detecte automáticamente
            });

            // ESTRATEGIA DE FUERZA BRUTA: Probar todas las combinaciones posibles
            const shopIds = [IZIPAY_SHOP_ID, '5647590'].filter(id => id);
            const keysToTry = [
                IZIPAY_CLIENT_KEY_RAW, // 1. Tal cual viene
                IZIPAY_CLIENT_KEY_RAW.includes('_') ? IZIPAY_CLIENT_KEY_RAW.split('_')[1] : null, // 2. Sanitizada
                process.env.IZIPAY_HMAC_SHA256?.trim(), // 3. HMAC como Pass
                'muPkleaAM1mXyyk9' // 4. Clave corta Legacy
            ].filter(k => k);

            let iziRes = { status: 'ERROR', errorMessage: 'No attempts made' };
            let success = false;

            for (const sId of shopIds) {
                if (success) break;
                for (const key of keysToTry) {
                    console.log(`[IZIPAY] Attempting Auth: Shop=${sId} | Key Len=${key.length} | Prefix=${key.slice(0, 5)}...`);
                    iziRes = await callIzipay(postData, sId, key);
                    if (iziRes.status === 'SUCCESS') {
                        success = true;
                        break;
                    }
                    if (iziRes.answer?.errorCode !== 'INT_905') {
                        // Si el error NO es de credenciales, quizás es otro problema serio
                        console.warn(`[IZIPAY] Warning: Received non-auth error: ${iziRes.answer?.errorCode}`);
                    }
                }
            }

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
