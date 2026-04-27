const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const https = require('https');

const CRON_SECRET = process.env.CRON_SECRET || '';

const IZIPAY_TEST_SHOP_ID = '38106701';
const IZIPAY_TEST_KEY = 'testpassword_m2Sz4S5Ep7ZYZm5Q03BMaDhZ3gmApebfsc7csfWSlu3OG';
const IS_PRODUCTION = false;
const IZIPAY_SHOP_ID = IS_PRODUCTION ? (process.env.IZIPAY_SHOP_ID || '') : IZIPAY_TEST_SHOP_ID;
const IZIPAY_KEY = IS_PRODUCTION ? (process.env.IZIPAY_CLIENT_KEY || '') : IZIPAY_TEST_KEY;

function normalizeShopId(id) {
    if (!id) return null;
    let clean = id.toString().trim();
    if (clean.length > 8 && clean.startsWith('0')) clean = clean.slice(1);
    while (clean.length < 8) clean = '0' + clean;
    return clean;
}

async function callIzipay(postData, shopId, key, endpoint = 'api.micuentaweb.pe', customPath = null) {
    const apiPath = customPath || '/api-payment/V4/Charge/CreatePayment';
    const cleanId = shopId.toString().trim();
    const cleanKey = key.toString().trim();
    const authHeader = 'Basic ' + Buffer.from(`${cleanId}:${cleanKey}`).toString('base64');

    let mode = 'PRODUCTION';
    try { mode = JSON.parse(postData).ctx_mode || 'PRODUCTION'; } catch { /* ignore */ }

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
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ status: 'ERROR', errorMessage: 'Invalid JSON from Izipay' }); }
            });
        });
        request.on('error', (err) => reject(err));
        request.write(postData);
        request.end();
    });
}

let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        email: String,
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan: { type: String, default: null },
        membershipAutoRenew: { type: Boolean, default: false },
        membershipCanceledAt: { type: Date, default: null },
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
        currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' },
        durationDays: { type: Number, default: 30 },
        isActive: { type: Boolean, default: true }
    });
    Membership = mongoose.model('Membership', schema);
}

let Payment;
try { Payment = mongoose.model('Payment'); } catch {
    const schema = new mongoose.Schema({
        orderId: { type: String, default: '' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        kind: { type: String, enum: ['checkout', 'renewal'], default: 'renewal' },
        status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'pending' },
        amountCents: { type: Number, default: 0 },
        currency: { type: String, default: '' },
        raw: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now }
    });
    schema.index({ orderId: 1 }, { unique: true, sparse: true });
    Payment = mongoose.model('Payment', schema);
}

function shouldAuthorize(req) {
    if (!CRON_SECRET) return false;
    const provided = (req.headers['x-cron-secret'] || '').toString();
    return provided && provided === CRON_SECRET;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cron-Secret');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método no permitido' });

    if (!shouldAuthorize(req)) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    try { await connectDB(); } catch (e) {
        return res.status(500).json({ success: false, message: 'DB error', error: e.message });
    }

    const now = new Date();
    const dueUsers = await User.find({
        membershipAutoRenew: true,
        membershipCanceledAt: null,
        membershipExpiresAt: { $ne: null, $lte: now },
        izipayPaymentMethodToken: { $exists: true, $ne: '' },
        activeMembership: { $ne: null }
    }).limit(50);

    const mode = 'TEST';
    const shopId = normalizeShopId(IZIPAY_SHOP_ID);
    const key = IZIPAY_KEY;

    const results = [];

    for (const user of dueUsers) {
        try {
            const membership = await Membership.findById(user.activeMembership);
            if (!membership) {
                results.push({ userId: user._id, ok: false, error: 'membership_not_found' });
                continue;
            }
            if (!membership.durationDays || membership.durationDays === 0) {
                user.membershipAutoRenew = false;
                user.updatedAt = Date.now();
                await user.save();
                results.push({ userId: user._id, ok: true, skipped: true, reason: 'lifetime_plan' });
                continue;
            }

            const amountCents = Math.round(Number(membership.price || 0) * 100);
            const orderId = `R${Date.now().toString().slice(-8)}--${String(user._id).slice(-6)}--${String(membership._id).slice(-6)}`;

            await Payment.create({
                orderId,
                userId: user._id,
                membershipId: membership._id,
                kind: 'renewal',
                status: 'pending',
                amountCents,
                currency: membership.currency || 'PEN',
                raw: {}
            }).catch(() => { /* ignore duplicates */ });

            const body = {
                amount: amountCents,
                currency: mode === 'TEST' ? 'USD' : (membership.currency || 'PEN'),
                orderId,
                customer: {
                    email: user.email || 'customer@example.com',
                    reference: String(user._id)
                },
                paymentMethodToken: String(user.izipayPaymentMethodToken || '').trim(),
                metadata: {
                    userId: String(user._id),
                    membershipId: String(membership._id),
                    platform: 'IATIBET_ZUREON',
                    recurring: true
                },
                ctx_mode: mode
            };

            const iziRes = await callIzipay(JSON.stringify(body), shopId, key, 'api.micuentaweb.pe', '/api-payment/V4/Charge/CreatePayment');

            const paid = iziRes?.status === 'SUCCESS' && iziRes?.answer?.orderStatus === 'PAID';
            await Payment.updateOne(
                { orderId },
                { $set: { status: paid ? 'paid' : 'pending', raw: iziRes } }
            );

            user.izipayLastOrderId = orderId;
            user.updatedAt = Date.now();
            await user.save();

            results.push({ userId: user._id, ok: true, orderId, paidImmediate: paid });
        } catch (e) {
            results.push({ userId: user._id, ok: false, error: e.message });
        }
    }

    return res.json({ success: true, now, processed: results.length, results });
};

