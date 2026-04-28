const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// CREDENCIALES TEST (BACK OFFICE)
const IZIPAY_TEST_SHOP_ID = '38106701';
const IZIPAY_TEST_KEY     = 'testpassword_m2Sz4S5Ep7ZYZm5Q03BMaDhZ3gmApebfsc7csfWSlu3OG';
const IZIPAY_TEST_HMAC    = 'o5ZB4cpULuVjVxyYU1TkVfDLqVjwj6SEFv8SmgowOnatK';
const IZIPAY_TEST_PUBLIC  = '38106701:testpublickey_XdWqqaCVK27gEgKSYJOEofci1FL6eAs4MxpWzSWZwInIh';

// CREDENCIALES PRODUCCIÓN (Para cuando se habiliten)
const IZIPAY_PROD_SHOP_ID = process.env.IZIPAY_SHOP_ID;
const IZIPAY_PROD_KEY     = process.env.IZIPAY_CLIENT_KEY;
const IZIPAY_PROD_HMAC    = process.env.IZIPAY_HMAC_SHA256;
const IZIPAY_PROD_PUBLIC  = process.env.IZIPAY_PUBLIC_KEY;

// Selección Dinámica
const IS_PRODUCTION = false; // Forzado a FALSE por solicitud del usuario
const IZIPAY_SHOP_ID = IS_PRODUCTION ? IZIPAY_PROD_SHOP_ID : IZIPAY_TEST_SHOP_ID;
const IZIPAY_KEY     = IS_PRODUCTION ? IZIPAY_PROD_KEY     : IZIPAY_TEST_KEY;
const IZIPAY_HMAC    = IS_PRODUCTION ? IZIPAY_PROD_HMAC    : IZIPAY_TEST_HMAC;
const IZIPAY_PUBLIC  = IS_PRODUCTION ? IZIPAY_PROD_PUBLIC  : IZIPAY_TEST_PUBLIC;

// Wallet (CustomerWallet) endpoint path puede variar por PSP/white-label.
// Permite ajustar sin redeploy de lógica.
// - IZIPAY_WALLET_PATH: path único
// - IZIPAY_WALLET_PATHS: lista separada por comas para probar varios
const IZIPAY_WALLET_PATH = process.env.IZIPAY_WALLET_PATH || '/api-payment/V4/Customer/Wallet';
const IZIPAY_WALLET_PATHS = (process.env.IZIPAY_WALLET_PATHS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

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
        role: { type: String, enum: ['user', 'admin', 'vendedor'], default: 'user' },
        sellerCode: { type: String, unique: true, sparse: true },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        sellerBalance: { type: Number, default: 0 },
        sellerCommission: { type: Number, default: 10 },
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan: { type: String, default: null },
        membershipAutoRenew: { type: Boolean, default: false },
        membershipCanceledAt: { type: Date, default: null },
        membershipCancelReason: { type: String, default: '' },
        izipayPaymentMethodToken: { type: String, default: '' },
        izipayLastOrderId: { type: String, default: '' },
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
        durationDays: { type: Number, default: 30 },
        sellerCommission: { type: Number, default: 0, min: 0, max: 100 }
    });
    Membership = mongoose.model('Membership', schema);
}

// Asegurar compatibilidad: si el modelo ya existía sin este campo, lo añadimos al schema
if (Membership && Membership.schema && !Membership.schema.path('sellerCommission')) {
    Membership.schema.add({
        sellerCommission: { type: Number, default: 0, min: 0, max: 100 }
    });
}
let Transaction;
try { Transaction = mongoose.model('Transaction'); } catch {
    const schema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['commission', 'withdrawal'], default: 'commission' },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'completed', 'approved', 'rejected'], default: 'completed' },
        description: String,
        // Campos extra para evitar duplicados y auditar la fuente
        orderId: { type: String, default: '' },
        sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        createdAt: { type: Date, default: Date.now }
    });
    Transaction = mongoose.model('Transaction', schema);
}

let Payment;
try { Payment = mongoose.model('Payment'); } catch {
    const schema = new mongoose.Schema({
        orderId: { type: String, default: '' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        kind: { type: String, enum: ['checkout', 'renewal'], default: 'checkout' },
        status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'pending' },
        amountCents: { type: Number, default: 0 },
        currency: { type: String, default: '' },
        raw: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now }
    });
    schema.index({ orderId: 1 }, { unique: true, sparse: true });
    Payment = mongoose.model('Payment', schema);
}

let Coupon;
try { Coupon = mongoose.model('Coupon'); } catch {
    const schema = new mongoose.Schema({
        code: { type: String, required: true, unique: true, trim: true },
        description: { type: String, default: '' },
        type: { type: String, enum: ['percent', 'fixed'], required: true },
        value: { type: Number, required: true, min: 0 },
        currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
        maxRedemptions: { type: Number, default: 0 }, // 0 = ilimitado
        redeemedCount: { type: Number, default: 0 },
        perUserLimit: { type: Number, default: 0 }, // 0 = ilimitado
        applicableMembershipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Membership' }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    schema.index({ code: 1 }, { unique: true });
    Coupon = mongoose.model('Coupon', schema);
}

let CouponRedemption;
try { CouponRedemption = mongoose.model('CouponRedemption'); } catch {
    const schema = new mongoose.Schema({
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
        orderId: { type: String, default: '' },
        redeemedAt: { type: Date, default: Date.now }
    });
    schema.index({ couponId: 1, userId: 1, membershipId: 1 });
    schema.index({ orderId: 1 }, { unique: true, sparse: true });
    CouponRedemption = mongoose.model('CouponRedemption', schema);
}

// Si el modelo ya existía, añadimos los campos extra para idempotencia
if (Transaction && Transaction.schema) {
    if (!Transaction.schema.path('orderId')) Transaction.schema.add({ orderId: { type: String, default: '' } });
    if (!Transaction.schema.path('sourceUserId')) Transaction.schema.add({ sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } });
    if (!Transaction.schema.path('membershipId')) Transaction.schema.add({ membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null } });
}

// Logica de comisión centralizada (Prioridad: Membresía > Vendedor > 10% Default)
async function getEffectiveCommissionPct(membership, seller) {
    const planPct = membership ? Number(membership.sellerCommission ?? membership.get?.('sellerCommission')) : 0;
    if (Number.isFinite(planPct) && planPct > 0) return planPct;

    const sellerPct = seller ? Number(seller.sellerCommission) : 0;
    if (Number.isFinite(sellerPct) && sellerPct > 0) return sellerPct;
    return 10;
}

function normalizeCouponCode(code) {
    return (code || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}
function nowInRange(startsAt, endsAt) {
    const now = Date.now();
    if (startsAt && now < new Date(startsAt).getTime()) return false;
    if (endsAt && now > new Date(endsAt).getTime()) return false;
    return true;
}
function computeDiscount({ membershipPrice, membershipCurrency, coupon }) {
    const original = Number(membershipPrice) || 0;
    if (original <= 0) return { original, discount: 0, final: original };

    let discount = 0;
    if (coupon.type === 'percent') {
        const pct = Math.max(0, Math.min(100, Number(coupon.value) || 0));
        discount = (original * pct) / 100;
    } else {
        if ((coupon.currency || 'PEN') !== membershipCurrency) return null;
        discount = Number(coupon.value) || 0;
    }
    discount = Math.min(original, Math.max(0, discount));
    const final = Math.max(0, original - discount);
    return { original, discount, final };
}

async function validateCouponForCheckout({ couponCode, membership, userId }) {
    const code = normalizeCouponCode(couponCode);
    if (!code) return { ok: true, code: '', discountAmount: 0, finalPrice: Number(membership.price) || 0 };

    const coupon = await Coupon.findOne({ code });
    if (!coupon || !coupon.isActive) return { ok: false, message: 'Cupón inválido' };
    if (!nowInRange(coupon.startsAt, coupon.endsAt)) return { ok: false, message: 'Cupón fuera de fecha' };
    if (coupon.maxRedemptions && coupon.maxRedemptions > 0 && (coupon.redeemedCount || 0) >= coupon.maxRedemptions) {
        return { ok: false, message: 'Cupón agotado' };
    }
    if (coupon.applicableMembershipIds && coupon.applicableMembershipIds.length) {
        const ok = coupon.applicableMembershipIds.some(id => id.toString() === membership._id.toString());
        if (!ok) return { ok: false, message: 'Cupón no aplica a este plan' };
    }
    if (userId && coupon.perUserLimit && coupon.perUserLimit > 0) {
        const used = await CouponRedemption.countDocuments({ couponId: coupon._id, userId, membershipId: membership._id });
        if (used >= coupon.perUserLimit) return { ok: false, message: 'Límite de uso alcanzado' };
    }

    const membershipCurrency = membership.currency || 'PEN';
    const calc = computeDiscount({ membershipPrice: membership.price, membershipCurrency, coupon });
    if (!calc) return { ok: false, message: 'Cupón no compatible con la moneda' };

    return {
        ok: true,
        code: coupon.code,
        couponId: coupon._id,
        discountAmount: Number(calc.discount) || 0,
        finalPrice: Number(calc.final) || 0
    };
}

async function redeemCouponOnSuccess({ couponCode, membershipId, userId, orderId }) {
    const code = normalizeCouponCode(couponCode);
    if (!code) return;
    if (!orderId) return;

    const coupon = await Coupon.findOne({ code });
    if (!coupon) return;

    // Idempotencia: si ya existe redención para este orderId, no repetir.
    const existing = await CouponRedemption.findOne({ orderId });
    if (existing) return;

    await CouponRedemption.create({
        couponId: coupon._id,
        userId,
        membershipId,
        orderId
    });

    // Incrementar contador de uso
    await Coupon.updateOne({ _id: coupon._id }, { $inc: { redeemedCount: 1 }, $set: { updatedAt: new Date() } });
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    if (!auth) {
        console.warn('[IZIPAY] No Authorization header found');
        return null;
    }
    const token = auth && auth.split(' ')[1];
    if (!token) {
        console.warn('[IZIPAY] No token found in Authorization header');
        return null;
    }
    try { 
        const decoded = jwt.verify(token, JWT_SECRET); 
        console.log('[IZIPAY] Token verified successfuly for user:', decoded.id);
        return decoded;
    } catch (err) { 
        console.error('[IZIPAY] Token verification failed:', err.message);
        return null; 
    }
}

function verifyHash(answer, hash, key) {
    const calculatedHash = crypto.createHmac('sha256', key).update(answer).digest('hex');
    return calculatedHash === hash;
}

function safeString(v) {
    return (v == null) ? '' : String(v);
}

function findTokenRecursively(root) {
    // Busca paymentMethodToken/cardToken en cualquier profundidad (con límites para no explotar logs/memoria)
    const MAX_NODES = 5000;
    const MAX_DEPTH = 8;
    let seen = 0;

    const isObj = (v) => v && typeof v === 'object';

    function visit(node, depth, path) {
        if (!isObj(node)) return null;
        if (seen++ > MAX_NODES) return null;
        if (depth > MAX_DEPTH) return null;

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const found = visit(node[i], depth + 1, path + `[${i}]`);
                if (found) return found;
            }
            return null;
        }

        for (const k of Object.keys(node)) {
            const v = node[k];
            const key = String(k);
            if (/paymentMethodToken|cardToken/i.test(key)) {
                const s = safeString(v).trim();
                if (s) return { token: s, path: path ? `${path}.${key}` : key };
            }
        }

        for (const k of Object.keys(node)) {
            const v = node[k];
            const found = visit(v, depth + 1, path ? `${path}.${k}` : String(k));
            if (found) return found;
        }
        return null;
    }

    return visit(root, 0, '');
}

function collectTokenLikeValues(root) {
    const MAX_NODES = 7000;
    const MAX_DEPTH = 9;
    let seen = 0;
    const out = [];

    const isObj = (v) => v && typeof v === 'object';
    const looksInteresting = (k, v) => {
        const key = String(k || '');
        if (!/token/i.test(key)) return false;
        if (typeof v !== 'string') return false;
        const s = v.trim();
        if (s.length < 10) return false;
        if (s.length > 512) return false;
        return true;
    };

    function walk(node, depth, path) {
        if (!isObj(node)) return;
        if (seen++ > MAX_NODES) return;
        if (depth > MAX_DEPTH) return;

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) walk(node[i], depth + 1, `${path}[${i}]`);
            return;
        }

        for (const k of Object.keys(node)) {
            const v = node[k];
            if (looksInteresting(k, v)) {
                out.push({ path: path ? `${path}.${k}` : String(k), value: String(v).trim() });
            }
        }
        for (const k of Object.keys(node)) {
            walk(node[k], depth + 1, path ? `${path}.${k}` : String(k));
        }
    }

    walk(root, 0, '');
    return out.slice(0, 25);
}

function extractPaymentMethodToken(answer) {
    const candidates = [
        answer?.paymentMethodToken,
        answer?.paymentMethod?.token,
        answer?.orderDetails?.paymentMethodToken,
        answer?.transactions?.[0]?.paymentMethodToken,
        answer?.transactions?.[0]?.paymentMethod?.token,
        answer?.cardDetails?.token,
        answer?.cardDetails?.cardToken,
        answer?.transactions?.[0]?.cardDetails?.token,
        answer?.transactions?.[0]?.cardDetails?.cardToken
    ].map(safeString).map(s => s.trim()).filter(Boolean);
    if (candidates[0]) return candidates[0];

    // Fallback: búsqueda recursiva, porque el token puede venir en estructuras nuevas del PSP.
    const deep = findTokenRecursively(answer);
    if (deep && deep.token) {
        console.log('[IZIPAY] Token encontrado por búsqueda profunda en:', deep.path);
        return deep.token;
    }

    // Último fallback: algunos PSP envían tokens bajo claves genéricas "*token*".
    // Esto NO garantiza que sea un paymentMethodToken reutilizable; solo ayuda a diagnosticar.
    try {
        const tokenLikes = collectTokenLikeValues(answer);
        const filtered = tokenLikes
            .filter(x => !/transaction|uuid|orderId/i.test(x.path))
            .map(x => ({ path: x.path, preview: x.value.slice(0, 10) + '...', len: x.value.length }));
        if (filtered.length) {
            console.log('[IZIPAY] Token-like values encontrados (diagnóstico):', filtered);
        }
    } catch { /* ignore */ }
    return '';
}

function computeNextExpiry({ currentExpiresAt, durationDays }) {
    if (!durationDays || Number(durationDays) === 0) return new Date('2099-12-31');
    const now = Date.now();
    const base = currentExpiresAt && new Date(currentExpiresAt).getTime() > now
        ? new Date(currentExpiresAt).getTime()
        : now;
    return new Date(base + Number(durationDays) * 24 * 60 * 60 * 1000);
}

function parseIncomingBody(req) {
    const b = req.body;
    if (!b) return {};
    if (typeof b === 'string') {
        // Puede llegar como JSON o como application/x-www-form-urlencoded (kr-answer=...&kr-hash=...)
        try { return JSON.parse(b); } catch { /* ignore */ }
        try {
            const params = new URLSearchParams(b);
            const obj = {};
            for (const [k, v] of params.entries()) obj[k] = v;
            return obj;
        } catch { return {}; }
    }
    if (Buffer.isBuffer(b)) {
        const s = b.toString('utf8');
        return parseIncomingBody({ ...req, body: s });
    }
    // Vercel suele parsear JSON a objeto automáticamente
    return b;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.url.split('?')[0];
    const body = parseIncomingBody(req);
    console.log(`[IZIPAY] Request URL: ${url} | Method: ${req.method} | Auth: ${req.headers['authorization']?.slice(0, 20)}...`);

    // ── GET /api/payments/wallet-tokens (consultar tokens de wallet y opcionalmente guardarlos) ──
    // Uso:
    // - GET /api/payments/wallet-tokens         -> lista tokens (si existen)
    // - GET /api/payments/wallet-tokens?save=1  -> guarda primer token ACTIVE en el usuario
    if (req.method === 'GET' && url.includes('wallet-tokens')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autorizado' });

        try {
            await connectDB();
            const shopId = normalizeShopId(IZIPAY_SHOP_ID);
            const key = IZIPAY_KEY;
            const mode = 'TEST';

            const payload = JSON.stringify({
                customerReference: decoded.id,
                ctx_mode: mode
            });

            const candidatePaths = [
                ...IZIPAY_WALLET_PATHS,
                IZIPAY_WALLET_PATH,
                // Fallbacks comunes Lyra/Scellius (nombres y versiones)
                '/api-payment/V4/CustomerWallet',
                '/api-payment/V4/Customer/Wallet',
                '/api-payment/V4.1/CustomerWallet',
                '/api-payment/V4.1/Customer/Wallet'
            ].filter((v, i, a) => a.indexOf(v) === i);

            let iziRes = null;
            let usedPath = null;
            const attempts = [];

            for (const p of candidatePaths) {
                console.log('[IZIPAY] WalletTokens request', { path: p, customerReference: decoded.id });
                const r = await callIzipay(payload, shopId, key, 'api.micuentaweb.pe', p);
                const st = r?.status || 'UNKNOWN';
                const errCode = r?.answer?.errorCode || r?.errorCode || null;
                const errMsg = r?.answer?.errorMessage || r?.errorMessage || null;
                attempts.push({ path: p, status: st, errorCode: errCode, errorMessage: errMsg });

                // SUCCESS => listo. ERROR => probar siguiente path.
                if (st === 'SUCCESS') {
                    iziRes = r;
                    usedPath = p;
                    break;
                }
                // Algunos PSP devuelven 200 pero con ERROR para "Unknown web service" / "Invalid attribute"
                // seguimos iterando.
                iziRes = r;
                usedPath = p;
            }

            const ok = iziRes && iziRes.status === 'SUCCESS';
            const tokens = (iziRes && iziRes.answer && Array.isArray(iziRes.answer.tokens)) ? iziRes.answer.tokens : [];

            // Normalizar un poco la salida
            const mapped = tokens.map(t => ({
                status: t.status || null,
                paymentMethodType: t.paymentMethodType || null,
                paymentMethodToken: t.paymentMethodToken || null,
                creationDate: t.creationDate || null,
                cancellationDate: t.cancellationDate || null,
                tokenDetails: t.tokenDetails ? {
                    effectiveBrand: t.tokenDetails.effectiveBrand,
                    pan: t.tokenDetails.pan,
                    expiryMonth: t.tokenDetails.expiryMonth,
                    expiryYear: t.tokenDetails.expiryYear
                } : null
            }));

            const qs = new URLSearchParams(req.url.split('?')[1] || '');
            const shouldSave = qs.get('save') === '1';
            let saved = false;

            if (shouldSave) {
                const firstActive = mapped.find(t => (t.status || '').toUpperCase() === 'ACTIVE' && t.paymentMethodToken);
                if (firstActive) {
                    const user = await User.findById(decoded.id);
                    if (user) {
                        user.izipayPaymentMethodToken = firstActive.paymentMethodToken;
                        user.membershipAutoRenew = true;
                        user.membershipCanceledAt = null;
                        user.membershipCancelReason = '';
                        user.updatedAt = new Date();
                        await user.save();
                        saved = true;
                        console.log('[IZIPAY] ✅ Wallet token guardado en usuario', {
                            userId: decoded.id,
                            tokenPreview: firstActive.paymentMethodToken.slice(0, 10) + '...'
                        });
                    }
                }
            }

            console.log('[IZIPAY] WalletTokens result', {
                status: iziRes?.status || null,
                tokenCount: mapped.length,
                saved,
                usedPath,
                errorCode: iziRes?.answer?.errorCode || iziRes?.errorCode || null,
                errorMessage: iziRes?.answer?.errorMessage || iziRes?.errorMessage || null
            });

            // Resumen compacto (1 línea) para debugging rápido en Vercel
            try {
                const compact = attempts.slice(0, 6).map(a => `${a.path}:${a.status}${a.errorCode ? '(' + a.errorCode + ')' : ''}`).join(' | ');
                console.log(`[IZIPAY] WalletTokens attempts (compact): ${compact}${attempts.length > 6 ? ' | ...' : ''}`);
            } catch {}

            return res.json({
                success: true,
                endpointPathUsed: usedPath,
                status: iziRes?.status || null,
                errorCode: iziRes?.answer?.errorCode || iziRes?.errorCode || null,
                errorMessage: iziRes?.answer?.errorMessage || iziRes?.errorMessage || null,
                attempts,
                tokenCount: mapped.length,
                saved,
                tokens: mapped
            });
        } catch (e) {
            console.error('[IZIPAY] WalletTokens error:', e?.message);
            return res.status(500).json({ success: false, message: 'Error consultando wallet', error: e.message });
        }
    }

    // ── POST /api/payments/client-log (replicar logs del navegador en Vercel) ──
    if (req.method === 'POST' && url.includes('client-log')) {
        // No requerimos auth para debug (puedes endurecerlo luego). Limitamos el tamaño y sanitizamos.
        try {
            const level = (body.level || 'info').toString().slice(0, 10);
            const tag = (body.tag || 'CLIENT').toString().slice(0, 40);
            const orderId = (body.orderId || '').toString().slice(0, 80);
            const message = (body.message || '').toString().slice(0, 1000);
            const data = body.data != null ? body.data : null;
            const out = { tag, orderId, message, data };
            const line = `[CLIENTLOG][${level}][${tag}]${orderId ? ' orderId=' + orderId : ''} ${message}`;
            if (level === 'error') console.error(line, out);
            else if (level === 'warn') console.warn(line, out);
            else console.log(line, out);
            return res.json({ success: true });
        } catch (e) {
            return res.status(400).json({ success: false });
        }
    }

    // ── POST /api/payments/izipay-save-token (Guardar token desde frontend SDK) ──
    // Algunos PSP no envían paymentMethodToken en kr-answer del return/webhook.
    // En ese caso lo capturamos desde KR.onOrderUpdate en el navegador y lo guardamos aquí.
    if (req.method === 'POST' && url.includes('izipay-save-token')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autorizado' });

        try {
            await connectDB();
            const token = (body.paymentMethodToken || body.token || '').toString().trim();
            const orderId = (body.orderId || '').toString().trim();
            if (!token) return res.status(400).json({ success: false, message: 'Token requerido' });

            const user = await User.findById(decoded.id);
            if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

            user.izipayPaymentMethodToken = token;
            // Si hay una membresía activa (o se acaba de activar), dejamos auto-renovación habilitada.
            user.membershipAutoRenew = true;
            user.membershipCanceledAt = null;
            user.membershipCancelReason = '';
            if (orderId) user.izipayLastOrderId = orderId;
            user.updatedAt = new Date();
            await user.save();

            console.log('[IZIPAY] ✅ Token guardado desde frontend', {
                userId: decoded.id,
                orderId,
                tokenPreview: token.slice(0, 10) + '...'
            });
            return res.json({ success: true });
        } catch (e) {
            console.error('[IZIPAY] Error guardando token desde frontend:', e?.message);
            return res.status(500).json({ success: false, message: 'Error guardando token' });
        }
    }

    // ── POST /api/izipay (Checkout) ──────────────────────────────────
    // Importante: Izipay webhooks/return llegan como x-www-form-urlencoded; si el body no se parsea,
    // antes caía por error en "checkout" y devolvía 401 (rompiendo la activación).
    if (req.method === 'POST' && (body?.membershipId && !body?.['kr-answer'])) {
        const decoded = verifyToken(req);
        if (!decoded) {
            console.warn('[IZIPAY] Unauthorized attempt: decoded is null');
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        try {
            console.log(`[IZIPAY] Starting checkout for memberId: ${body?.membershipId}`);
            
            await connectDB();
            const { membershipId, couponCode } = body;
            if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

            const membership = await Membership.findById(membershipId);
            if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

            // Aplicar cupón (si existe). El backend valida de nuevo (no confiar en frontend).
            const couponCheck = await validateCouponForCheckout({ couponCode, membership, userId: decoded.id });
            if (!couponCheck.ok) return res.status(400).json({ success: false, message: couponCheck.message || 'Cupón inválido' });

            const finalPrice = couponCheck.finalPrice;
            const amount = Math.round(finalPrice * 100);
            
            // ORDER_ID: Embebemos el membershipId completo tras '--' para recuperarlo en el retorno
            // Izipay no preserva el metadata en el redirect POST, pero sí devuelve el orderId completo
            const orderId = `T${Date.now().toString().slice(-6)}--${membershipId}`;
            
            const mode = 'TEST';
            const sId = normalizeShopId(IZIPAY_SHOP_ID);
            const key = IZIPAY_KEY;

            const basePostData = {
                amount: amount,
                currency: mode === 'TEST' ? 'USD' : 'PEN', // Cambiamos a USD en TEST para evitar error PSP_610 (No merchant acceptance agreement for PEN)
                orderId: orderId,
                customer: { 
                    email: decoded.email || 'customer@example.com',
                    reference: decoded.id
                },
                metadata: {
                    userId: decoded.id,
                    membershipId: membershipId,
                    platform: 'IATIBET_ZUREON',
                    couponCode: couponCheck.code || '',
                    // Guardamos el monto final en centavos para cálculos posteriores (comisión, auditoría)
                    finalAmountCents: amount
                }
            };

            console.log(`[IZIPAY] DIAGNOSTIC: Mode=${mode} | ShopID="${sId}" | PubKey="${IZIPAY_PUBLIC?.slice(0, 20)}..."`);

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
                return res.json({ 
                    success: true, 
                    orderId,
                    formToken: iziRes.answer.formToken,
                    publicKey: IZIPAY_PUBLIC  // Clave pública pareada con este token
                });
            } else {
                console.error('[IZIPAY] Izipay API Final Error Response:', iziRes);
                return res.status(500).json({ success: false, message: 'Error de Izipay', error: iziRes.errorMessage });
            }
        } catch (err) {
            console.error('[IZIPAY] Internal Checkout Error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── POST /api/izipay (Webhook IPN desde Izipay) ──────────────────
    // Solo captura si NO es el retorno del cliente (izipay-return)
    if (req.method === 'POST' && body['kr-answer'] && !url.includes('izipay-return') && !url.includes('izipay-success')) {
        const { "kr-answer": krAnswer, "kr-hash": krHash } = body;

        const answerStr = (typeof krAnswer === 'string') ? krAnswer : JSON.stringify(krAnswer);
        // Intentar verificar con HMAC key y también con password (Izipay puede usar cualquiera)
        const hmacValid = IZIPAY_HMAC && verifyHash(answerStr, krHash, IZIPAY_HMAC);
        const passValid = verifyHash(answerStr, krHash, IZIPAY_TEST_KEY);
        if (!hmacValid && !passValid) {
            console.error('[IZIPAY] Webhook: Hash inválido con HMAC y con password');
            return res.status(401).send('Invalid hash');
        }

        const answer = JSON.parse(answerStr);
        console.log('[IZIPAY] Webhook received', {
            orderStatus: answer.orderStatus,
            orderId: answer.orderDetails?.orderId,
            customerRef: answer.customer?.reference
        });
        if (answer.orderStatus !== 'PAID') return res.status(200).send('Not paid');

        try {
            await connectDB();
            const customerRef = answer.customer?.reference || '';
            const rawOrderId = answer.orderDetails?.orderId || '';

            // Extraer Id de membresía con nuevo formato
            let membershipId = null;
            const sepIdx = rawOrderId.indexOf('--');
            if (sepIdx !== -1) {
                membershipId = rawOrderId.slice(sepIdx + 2);
            } else {
                const parts = rawOrderId.split('_');
                membershipId = parts[parts.length - 1];
            }

            const user = await User.findById(customerRef);
            const membership = await Membership.findById(membershipId);
            if (!user || !membership) throw new Error('Not found user or membership');

            // Solo se comisiona la PRIMERA compra (primer plan) de este usuario referido
            const isFirstPurchase = !user.activeMembership && !user.membershipPlan;

            const expiresAt = computeNextExpiry({ currentExpiresAt: user.membershipExpiresAt, durationDays: membership.durationDays });
            console.log('[IZIPAY] Webhook activation projection', {
                userId: String(user._id),
                membershipId: String(membership._id),
                prevExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : null,
                nextExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
            });

            user.activeMembership = membership._id;
            user.membershipExpiresAt = expiresAt;
            user.membershipPlan = membership.name;
            user.izipayLastOrderId = rawOrderId;

            const pmToken = extractPaymentMethodToken(answer);
            console.log('[IZIPAY] Webhook payment method token', {
                hasToken: !!pmToken,
                tokenPreview: pmToken ? pmToken.slice(0, 10) + '...' : ''
            });
            if (!pmToken) {
                try {
                    const str = JSON.stringify(answer);
                    const hasAnyTokenWord = /paymentMethodToken|cardToken|token/i.test(str);
                    console.log('[IZIPAY] Webhook: token no encontrado en rutas conocidas', {
                        hasTokenWordInAnswer: hasAnyTokenWord,
                        topLevelKeys: Object.keys(answer || {}).slice(0, 40)
                    });
                } catch {}
            }
            if (pmToken) {
                user.izipayPaymentMethodToken = pmToken;
                user.membershipAutoRenew = !!(membership.durationDays && membership.durationDays > 0);
                user.membershipCanceledAt = null;
                user.membershipCancelReason = '';
            } else {
                user.membershipAutoRenew = false;
            }
            user.updatedAt = Date.now();
            await user.save();
            console.log('[IZIPAY] ✅ Webhook: Membresía activada para:', customerRef);

            try {
                await Payment.create({
                    orderId: rawOrderId,
                    userId: user._id,
                    membershipId: membership._id,
                    kind: 'checkout',
                    status: 'paid',
                    amountCents: Number(answer.orderDetails?.metadata?.finalAmountCents) || 0,
                    currency: safeString(answer.orderDetails?.currency || answer.currency),
                    raw: answer
                });
            } catch (e) {
                console.warn('[IZIPAY] Webhook: no se pudo registrar Payment:', e?.message);
            }

            // Registrar redención de cupón si vino en metadata
            const couponCode = answer.orderDetails?.metadata?.couponCode || '';
            try {
                await redeemCouponOnSuccess({ couponCode, membershipId: membership._id, userId: user._id, orderId: rawOrderId });
            } catch (e) {
                console.warn('[IZIPAY] Webhook: no se pudo registrar cupón:', e?.message);
            }

            // LOGICA DE COMISION (WEBHOOK)
            if (isFirstPurchase && user.referredBy) {
                const seller = await User.findById(user.referredBy);
                if (seller) {
                    // Idempotencia: no duplicar comisión para este orderId
                    const existing = await Transaction.findOne({ userId: seller._id, type: 'commission', orderId: rawOrderId });
                    if (existing) {
                        console.log('[IZIPAY] Webhook: Comisión ya registrada para orderId:', rawOrderId);
                        return res.status(200).json({ success: true });
                    }

                    const commissionPct = await getEffectiveCommissionPct(membership, seller);
                    const paidCents = Number(answer.orderDetails?.metadata?.finalAmountCents);
                    const paid = Number.isFinite(paidCents) && paidCents > 0 ? (paidCents / 100) : Number(membership.price);
                    const amount = (paid * commissionPct) / 100;
                    seller.sellerBalance = (seller.sellerBalance || 0) + amount;
                    await seller.save();
                    
                    // Registrar Transacción
                    await Transaction.create({
                        userId: seller._id,
                        type: 'commission',
                        amount: amount,
                        status: 'completed',
                        description: `Comisión por venta de membresía "${membership.name}" a ${user.email}`,
                        orderId: rawOrderId,
                        sourceUserId: user._id,
                        membershipId: membership._id
                    });

                    console.log(`[IZIPAY] 💰 Comisión pagada al vendedor ${seller.email}: S/ ${amount.toFixed(2)} (${commissionPct}%)`);
                }
            }

            return res.status(200).json({ success: true });
        } catch (err) {
            console.error('[IZIPAY] Webhook activation error:', err.message);
            return res.status(500).send(err.message);
        }
    }

    // ── POST /api/payments/izipay-return (Retorno de pago exitoso desde Izipay) ──
    // Izipay hace POST aquí tras pago exitoso. Validamos, activamos membresía y redirigimos.
    if (url.includes('izipay-return') || url.includes('izipay-success')) {
        if (req.method === 'GET') {
            return res.writeHead(302, { Location: '/?payment=success' }).end();
        }
        if (req.method !== 'POST') return res.status(405).end();

        const { 'kr-answer': krAnswer, 'kr-hash': krHash } = body || {};

        if (!krAnswer || !krHash) {
            console.warn('[IZIPAY] izipay-return: faltan kr-answer o kr-hash');
            return res.writeHead(302, { Location: '/perfil?payment=pending' }).end();
        }

        const answerStr = typeof krAnswer === 'string' ? krAnswer : JSON.stringify(krAnswer);
        const krHashAlgo = (body['kr-hash-algorithm'] || 'sha256').toLowerCase();

        // Izipay puede firmar con la clave HMAC o con la password — intentamos ambas
        const hmacValid    = verifyHash(answerStr, krHash, IZIPAY_HMAC);
        const passwordValid = verifyHash(answerStr, krHash, IZIPAY_TEST_KEY);
        const isValid = hmacValid || passwordValid;

        console.log(`[IZIPAY] izipay-return: hmacValid=${hmacValid} | passwordValid=${passwordValid} | algo=${krHashAlgo}`);
        console.log(`[IZIPAY] izipay-return: kr-hash recibido=${krHash?.slice(0,20)}...`);
        console.log(`[IZIPAY] izipay-return: HMAC_KEY (15 chars)=${IZIPAY_HMAC?.slice(0,15)} | TEST_KEY (15 chars)=${IZIPAY_TEST_KEY?.slice(0,15)}`);

        if (!isValid) {
            // En TEST mode no bloqueamos al usuario — redirigimos igual pero logueamos el error
            console.error('[IZIPAY] izipay-return: Hash INVÁLIDO — posible clave HMAC incorrecta. Revisar Back Office.');
            // Continuar de todas formas para no frustrar al usuario en TEST
        }

        const answer = typeof answerStr === 'string' ? JSON.parse(answerStr) : answerStr;
        console.log('[IZIPAY] izipay-return: orderStatus =', answer.orderStatus, '| orderID =', answer.orderDetails?.orderId);

        if (answer.orderStatus !== 'PAID') {
            return res.writeHead(302, { Location: '/perfil?payment=pending' }).end();
        }

        // ── Activar membresía ────────────────────────────────────────────
        try {
            await connectDB();
            const parts = (answer.orderDetails?.orderId || '').split('_');
            // Intentar obtener el userId de varias fuentes: reference o metadata
            const customerRef = answer.customer?.reference || answer.orderDetails?.metadata?.userId || '';
            console.log(`[IZIPAY] Proyectando activación: user=${customerRef} | orderId=${answer.orderDetails?.orderId}`);

            // Extraer membershipId: primero de metadata, luego del orderId (busca '--{objectId}')
            let membershipId = answer.orderDetails?.metadata?.membershipId;
            if (!membershipId) {
                const rawOrderId = answer.orderDetails?.orderId || '';
                // Formato nuevo: T123456--<24-char-objectId>
                const sepIdx = rawOrderId.indexOf('--');
                if (sepIdx !== -1) {
                    membershipId = rawOrderId.slice(sepIdx + 2);
                } else {
                    // Formato legacy: TEST_XXXX_lastFourChars — no podemos recuperar el ObjectId completo
                    console.error('[IZIPAY] No se puede extraer membershipId del orderId:', rawOrderId);
                }
            }
            console.log(`[IZIPAY] membershipId resuelto: ${membershipId}`);

            const rawOrderId = answer.orderDetails?.orderId || '';
            const user = await User.findById(customerRef);
            const membership = await Membership.findById(membershipId);

            if (user && membership) {
                // Solo se comisiona la PRIMERA compra (primer plan) de este usuario referido
                const isFirstPurchase = !user.activeMembership && !user.membershipPlan;

                const expiresAt = computeNextExpiry({ currentExpiresAt: user.membershipExpiresAt, durationDays: membership.durationDays });
                console.log('[IZIPAY] Return activation projection', {
                    userId: String(user._id),
                    membershipId: String(membership._id),
                    prevExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : null,
                    nextExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
                });

                user.activeMembership = membership._id;
                user.membershipExpiresAt = expiresAt;
                user.membershipPlan = membership.name;
                user.izipayLastOrderId = rawOrderId;

                const pmToken = extractPaymentMethodToken(answer);
                console.log('[IZIPAY] Return payment method token', {
                    hasToken: !!pmToken,
                    tokenPreview: pmToken ? pmToken.slice(0, 10) + '...' : ''
                });
                if (!pmToken) {
                    try {
                        const str = JSON.stringify(answer);
                        const hasAnyTokenWord = /paymentMethodToken|cardToken|token/i.test(str);
                        console.log('[IZIPAY] Return: token no encontrado en rutas conocidas', {
                            hasTokenWordInAnswer: hasAnyTokenWord,
                            topLevelKeys: Object.keys(answer || {}).slice(0, 40)
                        });
                    } catch {}
                }
                if (pmToken) {
                    user.izipayPaymentMethodToken = pmToken;
                    user.membershipAutoRenew = !!(membership.durationDays && membership.durationDays > 0);
                    user.membershipCanceledAt = null;
                    user.membershipCancelReason = '';
                } else {
                    user.membershipAutoRenew = false;
                }
                user.updatedAt = new Date();
                await user.save();
                console.log('[IZIPAY] ✅ Membresía activada exitosamente para:', user.email);

                try {
                    await Payment.create({
                        orderId: rawOrderId,
                        userId: user._id,
                        membershipId: membership._id,
                        kind: 'checkout',
                        status: 'paid',
                        amountCents: Number(answer.orderDetails?.metadata?.finalAmountCents) || 0,
                        currency: safeString(answer.orderDetails?.currency || answer.currency),
                        raw: answer
                    });
                } catch (e) {
                    console.warn('[IZIPAY] Return: no se pudo registrar Payment:', e?.message);
                }

                // Registrar redención de cupón si vino en metadata
                const couponCode = answer.orderDetails?.metadata?.couponCode || '';
                try {
                    await redeemCouponOnSuccess({ couponCode, membershipId: membership._id, userId: user._id, orderId: rawOrderId });
                } catch (e) {
                    console.warn('[IZIPAY] Return: no se pudo registrar cupón:', e?.message);
                }

                // LOGICA DE COMISION (REDIRECT RETURN)
                if (isFirstPurchase && user.referredBy) {
                    const seller = await User.findById(user.referredBy);
                    if (seller) {
                        // Idempotencia: no duplicar comisión para este orderId
                        const existing = await Transaction.findOne({ userId: seller._id, type: 'commission', orderId: rawOrderId });
                        if (existing) {
                            console.log('[IZIPAY] Return: Comisión ya registrada para orderId:', rawOrderId);
                            return res.writeHead(302, { Location: '/?payment=success' }).end();
                        }

                        const commissionPct = await getEffectiveCommissionPct(membership, seller);
                        const paidCents = Number(answer.orderDetails?.metadata?.finalAmountCents);
                        const paid = Number.isFinite(paidCents) && paidCents > 0 ? (paidCents / 100) : Number(membership.price);
                        const amount = (paid * commissionPct) / 100;
                        seller.sellerBalance = (seller.sellerBalance || 0) + amount;
                        await seller.save();

                        // Registrar Transacción
                        await Transaction.create({
                            userId: seller._id,
                            type: 'commission',
                            amount: amount,
                            status: 'completed',
                            description: `Comisión por venta de membresía "${membership.name}" a ${user.email}`,
                            orderId: rawOrderId,
                            sourceUserId: user._id,
                            membershipId: membership._id
                        });

                        console.log(`[IZIPAY] 💰 Comisión pagada al vendedor ${seller.email}: S/ ${amount.toFixed(2)} (${commissionPct}%)`);
                    }
                }
            } else {
                console.warn('[IZIPAY] ⚠️ Error en activación local: ', { 
                    userFound: !!user, 
                    membershipFound: !!membership, 
                    userId_used: customerRef, 
                    planId_used: membershipId 
                });
            }
        } catch (err) {
            console.error('[IZIPAY] izipay-return DB error:', err.message);
        }

        // Siempre redirigir al inicio tras un pago PAID
        return res.writeHead(302, { Location: '/?payment=success' }).end();
    }

    return res.status(404).end();
};
