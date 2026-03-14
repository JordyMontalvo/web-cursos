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
            // DEBUG DE CREDENCIALES (Seguro: solo muestra fragmentos)
            console.log(`[IZIPAY] Creds Debug: Shop=${IZIPAY_SHOP_ID} | Key Raw=${IZIPAY_CLIENT_KEY_RAW.slice(0,4)}...${IZIPAY_CLIENT_KEY_RAW.slice(-4)} | Len=${IZIPAY_CLIENT_KEY_RAW.length}`);
            
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
                customer: { email: decoded.email },
                // IMPORTANTE: Asegurar que estamos en producción
                ctx_mode: 'PRODUCTION'
            });

            // SECUENCIA DE INTENTOS DE AUTENTICACIÓN (4 NIVELES)
            // 1. Clave Raw (Ej: prodpassword_...)
            console.log(`[IZIPAY] Auth Attempt 1 (Raw Key, Len=${IZIPAY_CLIENT_KEY_RAW.length})`);
            let iziRes = await callIzipay(postData, IZIPAY_SHOP_ID, IZIPAY_CLIENT_KEY_RAW);

            // 2. Si falla, probar Sanitizada (Sin prefijo prodpassword_)
            if (iziRes.answer?.errorCode === 'INT_905' || !iziRes.answer) {
                let sanitizedKey = IZIPAY_CLIENT_KEY_RAW;
                if (sanitizedKey.includes('_')) sanitizedKey = sanitizedKey.split('_')[1];
                
                console.log(`[IZIPAY] Auth Attempt 2 (Sanitized, Len=${sanitizedKey.length})`);
                iziRes = await callIzipay(postData, IZIPAY_SHOP_ID, sanitizedKey);
            }

            // 3. Si falla, probar con la clave HMAC de 45 caracteres (A veces Izipay la usa como Pass)
            if (iziRes.answer?.errorCode === 'INT_905' && process.env.IZIPAY_HMAC_SHA256) {
                const hmacKey = process.env.IZIPAY_HMAC_SHA256.trim();
                console.log(`[IZIPAY] Auth Attempt 3 (HMAC Key, Len=${hmacKey.length})`);
                iziRes = await callIzipay(postData, IZIPAY_SHOP_ID, hmacKey);
            }
            
            // 4. ÚLTIMO RECURSO: Probar con la clave corta de producción (Ej: muPkle...) 
            // Si el usuario la puso en otra variable o si la clave RAW es muy corta, la usamos directamente.
            if (iziRes.answer?.errorCode === 'INT_905') {
                // Si tienes la clave corta (16 carac) de tu Imagen #1, ponla aquí o agrégala a Vercel como IZIPAY_SHORT_KEY
                const shortKey = (process.env.IZIPAY_SHORT_KEY || 'muPkleaAM1mXyyk9').trim(); 
                console.log(`[IZIPAY] Auth Attempt 4 (Legacy Short Key, Len=${shortKey.length})`);
                iziRes = await callIzipay(postData, IZIPAY_SHOP_ID, shortKey);
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
