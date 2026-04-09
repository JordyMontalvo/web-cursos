const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// ── Models ──────────────────────────────────────────────────────
const Banner = mongoose.models.Banner || mongoose.model('Banner', new mongoose.Schema({
    title: String, subtitle: String, imageUrl: String, linkUrl: String, order: Number, isActive: Boolean
}));

const Settings = mongoose.models.Settings || mongoose.models.Settings || mongoose.model('Settings', new mongoose.Schema({
    presentationVideoUrl: { type: String, default: '' },
    companyName: { type: String, default: 'IATIBET ZUREON' },
    logoUrl: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
}));

const LandingConfig = mongoose.models.LandingConfig || mongoose.model('LandingConfig', new mongoose.Schema({
    heroTitle: String,
    heroSubtitle: String,
    heroTrustItems: [String],
    featuresTitle: String,
    featuresSubtitle: String,
    features: [{ icon: String, title: String, description: String }],
    faqTitle: String,
    faqSubtitle: String,
    faqs: [{ question: String, answer: String }],
    guaranteeTitle: String,
    guaranteeDescription: String,
    guaranteeIcon: String,
    updatedAt: { type: Date, default: Date.now }
}));

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', new mongoose.Schema({
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
}));

const CouponRedemption = mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', new mongoose.Schema({
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
    orderId: { type: String, default: '' },
    redeemedAt: { type: Date, default: Date.now }
}));

const Membership = mongoose.models.Membership || mongoose.model('Membership', new mongoose.Schema({
    name: String,
    price: Number,
    currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' },
    isActive: { type: Boolean, default: true }
}));

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

function verifyToken(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function normalizeCouponCode(code) {
    return (code || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}
function couponNowInRange(startsAt, endsAt) {
    const now = Date.now();
    if (startsAt && now < new Date(startsAt).getTime()) return false;
    if (endsAt && now > new Date(endsAt).getTime()) return false;
    return true;
}
function computeCouponDiscount({ membershipPrice, membershipCurrency, coupon }) {
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

module.exports = async (req, res) => {
    const url = req.url.split('?')[0];
    const isAdminPath = url.includes('/admin/');
    const route = req.query?.route;
    
    if (isAdminPath || req.method !== 'GET') {
        setCORS(res, 'GET, POST, PUT, DELETE, OPTIONS');
    } else {
        setCORS(res, 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) { 
        console.error('DB Connection Error:', err);
        return res.status(500).json({ success: false, message: 'Error de conexión a base de datos' }); 
    }

    try {

    // ── PUBLIC: /api/config ────────────────────────────────────────────────
    if (route === 'config' || (url.includes('config') && !route)) {
        const testPubKey = '38106701:testpublickey_XdWqqaCVK27gEgKSYJOEofci1FL6eAs4MxpWzSWZwInIh';
        return res.json({
            apiUrl: process.env.BACKEND_URL || '',
            izipayPublicKey: testPubKey,
            izipayShopId: '38106701'
        });
    }

    // ── PUBLIC: /api/banners ───────────────────────────────────────────────
    if (route === 'public-banners' || (url.includes('banners') && !isAdminPath && !route)) {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        return res.json({ success: true, banners });
    }

    // ── PUBLIC: /api/settings ──────────────────────────────────────────────
    if (route === 'public-settings' || (url.includes('settings') && !isAdminPath && !route)) {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── PUBLIC: /api/landing-config ─────────────────────────────────────────
    if (route === 'public-landing-config' || (url.includes('landing-config') && !isAdminPath && !route)) {
        let config = await LandingConfig.findOne() || await LandingConfig.create({});
        return res.json({ success: true, config });
    }

    // ── PUBLIC (AUTH USER): /api/coupons/validate ──────────────────────────
    if (route === 'coupons-validate' && req.method === 'POST') {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autenticado' });

        const { code, membershipId } = req.body || {};
        const c = normalizeCouponCode(code);
        if (!c) return res.status(400).json({ success: false, message: 'Ingresa un cupón' });
        if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

        const membership = await Membership.findById(membershipId);
        if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

        const coupon = await Coupon.findOne({ code: c });
        if (!coupon || !coupon.isActive) return res.status(404).json({ success: false, message: 'Cupón inválido' });
        if (!couponNowInRange(coupon.startsAt, coupon.endsAt)) return res.status(400).json({ success: false, message: 'Cupón fuera de fecha' });
        if (coupon.maxRedemptions && coupon.maxRedemptions > 0 && (coupon.redeemedCount || 0) >= coupon.maxRedemptions) {
            return res.status(400).json({ success: false, message: 'Cupón agotado' });
        }
        if (coupon.applicableMembershipIds && coupon.applicableMembershipIds.length) {
            const ok = coupon.applicableMembershipIds.some(id => id.toString() === membershipId.toString());
            if (!ok) return res.status(400).json({ success: false, message: 'Cupón no aplica a este plan' });
        }
        if (coupon.perUserLimit && coupon.perUserLimit > 0) {
            const used = await CouponRedemption.countDocuments({ couponId: coupon._id, userId: decoded.id, membershipId });
            if (used >= coupon.perUserLimit) return res.status(400).json({ success: false, message: 'Límite de uso alcanzado' });
        }

        const membershipCurrency = membership.currency || 'PEN';
        const calc = computeCouponDiscount({ membershipPrice: membership.price, membershipCurrency, coupon });
        if (!calc) return res.status(400).json({ success: false, message: 'Cupón no compatible con la moneda' });

        const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
        return res.json({
            success: true,
            coupon: { code: coupon.code, description: coupon.description || '', type: coupon.type, value: coupon.value, currency: coupon.currency || 'PEN' },
            pricing: { currency: membershipCurrency, original: round2(calc.original), discount: round2(calc.discount), final: round2(calc.final) }
        });
    }

    // ── ADMIN: Authentication required ──
    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    // ── ADMIN: /api/admin/settings (GET) ──
    if (route === 'admin-settings' && req.method === 'GET') {
        let settings = await Settings.findOne() || await Settings.create({});
        return res.json({ success: true, settings });
    }

    // ── ADMIN: /api/admin/settings (PUT) ──
    if (route === 'admin-settings' && req.method === 'PUT') {
        const { presentationVideoUrl, companyName, logoUrl } = req.body;
        
        const updated = await Settings.findOneAndUpdate(
            {},
            {
                $set: {
                    ...(companyName !== undefined && { companyName }),
                    ...(logoUrl !== undefined && { logoUrl }),
                    ...(presentationVideoUrl !== undefined && { presentationVideoUrl }),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        return res.json({ success: true, settings: updated });
    }

    // ── ADMIN: /api/admin/landing-config (PUT) ──
    if ((route === 'admin-landing-config' && req.method === 'PUT') || (url.includes('landing-config') && req.method === 'PUT' && !route)) {
        const {
            heroTitle, heroSubtitle, heroTrustItems,
            featuresTitle, featuresSubtitle, features,
            faqTitle, faqSubtitle, faqs,
            guaranteeTitle, guaranteeDescription, guaranteeIcon
        } = req.body;

        const updated = await LandingConfig.findOneAndUpdate(
            {},
            {
                $set: {
                    ...(featuresTitle !== undefined && { featuresTitle }),
                    ...(featuresSubtitle !== undefined && { featuresSubtitle }),
                    ...(heroTitle !== undefined && { heroTitle }),
                    ...(heroSubtitle !== undefined && { heroSubtitle }),
                    ...(heroTrustItems !== undefined && { heroTrustItems: Array.isArray(heroTrustItems) ? heroTrustItems : [] }),
                    ...(features !== undefined && { features }),
                    ...(faqTitle !== undefined && { faqTitle }),
                    ...(faqSubtitle !== undefined && { faqSubtitle }),
                    ...(faqs !== undefined && { faqs }),
                    ...(guaranteeTitle !== undefined && { guaranteeTitle }),
                    ...(guaranteeDescription !== undefined && { guaranteeDescription }),
                    ...(guaranteeIcon !== undefined && { guaranteeIcon }),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );
        return res.json({ success: true, config: updated });
    }

    // ── ADMIN: /api/admin/coupons (CRUD) ──────────────────────────────────
    if (route === 'admin-coupons') {
        const id = req.query?.id || null;

        if (req.method === 'GET') {
            const coupons = await Coupon.find().sort({ createdAt: -1 });
            return res.json({ success: true, coupons });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const code = normalizeCouponCode(body.code);
            const type = body.type;
            const value = Number(body.value);
            if (!code) return res.status(400).json({ success: false, message: 'Código requerido' });
            if (!['percent', 'fixed'].includes(type)) return res.status(400).json({ success: false, message: 'Tipo inválido' });
            if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ success: false, message: 'Valor inválido' });

            const doc = new Coupon({
                code,
                description: (body.description || '').toString(),
                type,
                value,
                currency: (body.currency || 'PEN').toString(),
                startsAt: body.startsAt ? new Date(body.startsAt) : null,
                endsAt: body.endsAt ? new Date(body.endsAt) : null,
                isActive: body.isActive !== false,
                maxRedemptions: Number(body.maxRedemptions) || 0,
                perUserLimit: Number(body.perUserLimit) || 0,
                applicableMembershipIds: Array.isArray(body.applicableMembershipIds) ? body.applicableMembershipIds : [],
                updatedAt: new Date()
            });

            try {
                await doc.save();
            } catch (e) {
                if (e && e.code === 11000) return res.status(409).json({ success: false, message: 'Ese código ya existe' });
                throw e;
            }
            return res.json({ success: true, coupon: doc });
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const update = { updatedAt: new Date() };
            if (body.code !== undefined) update.code = normalizeCouponCode(body.code);
            if (body.description !== undefined) update.description = (body.description || '').toString();
            if (body.type !== undefined) update.type = body.type;
            if (body.value !== undefined) update.value = Number(body.value);
            if (body.currency !== undefined) update.currency = (body.currency || 'PEN').toString();
            if (body.startsAt !== undefined) update.startsAt = body.startsAt ? new Date(body.startsAt) : null;
            if (body.endsAt !== undefined) update.endsAt = body.endsAt ? new Date(body.endsAt) : null;
            if (body.isActive !== undefined) update.isActive = !!body.isActive;
            if (body.maxRedemptions !== undefined) update.maxRedemptions = Number(body.maxRedemptions) || 0;
            if (body.perUserLimit !== undefined) update.perUserLimit = Number(body.perUserLimit) || 0;
            if (body.applicableMembershipIds !== undefined) update.applicableMembershipIds = Array.isArray(body.applicableMembershipIds) ? body.applicableMembershipIds : [];

            try {
                const doc = await Coupon.findByIdAndUpdate(id, update, { new: true });
                if (!doc) return res.status(404).json({ success: false, message: 'Cupón no encontrado' });
                return res.json({ success: true, coupon: doc });
            } catch (e) {
                if (e && e.code === 11000) return res.status(409).json({ success: false, message: 'Ese código ya existe' });
                throw e;
            }
        }

        if (req.method === 'DELETE' && id) {
            await Coupon.findByIdAndDelete(id);
            return res.json({ success: true });
        }

        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    return res.status(404).end();
    } catch (error) {
        console.error('API Error in general.js:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};
