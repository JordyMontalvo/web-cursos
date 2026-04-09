const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

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
    orderId: { type: String, default: '' }, // se rellena en éxito para idempotencia
    redeemedAt: { type: Date, default: Date.now }
  });
  schema.index({ couponId: 1, userId: 1, membershipId: 1 });
  schema.index({ orderId: 1 }, { unique: true, sparse: true });
  CouponRedemption = mongoose.model('CouponRedemption', schema);
}

let Membership;
try { Membership = mongoose.model('Membership'); } catch {
  const schema = new mongoose.Schema({
    name: String,
    price: Number,
    currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' }
  });
  Membership = mongoose.model('Membership', schema);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyToken(req) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function normalizeCode(code) {
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

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.split('?')[0];
  if (!(req.method === 'POST' && url.endsWith('/validate'))) {
    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  }

  try { await connectDB(); } catch {
    return res.status(500).json({ success: false, message: 'DB error' });
  }

  const decoded = verifyToken(req); // opcional; si existe, aplicamos límites por usuario
  const { code, membershipId } = req.body || {};

  const c = normalizeCode(code);
  if (!c) return res.status(400).json({ success: false, message: 'Ingresa un cupón' });
  if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

  const membership = await Membership.findById(membershipId);
  if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

  const coupon = await Coupon.findOne({ code: c });
  if (!coupon || !coupon.isActive) return res.status(404).json({ success: false, message: 'Cupón inválido' });
  if (!nowInRange(coupon.startsAt, coupon.endsAt)) return res.status(400).json({ success: false, message: 'Cupón fuera de fecha' });
  if (coupon.maxRedemptions && coupon.maxRedemptions > 0 && (coupon.redeemedCount || 0) >= coupon.maxRedemptions) {
    return res.status(400).json({ success: false, message: 'Cupón agotado' });
  }

  if (coupon.applicableMembershipIds && coupon.applicableMembershipIds.length) {
    const ok = coupon.applicableMembershipIds.some(id => id.toString() === membershipId.toString());
    if (!ok) return res.status(400).json({ success: false, message: 'Cupón no aplica a este plan' });
  }

  if (decoded && coupon.perUserLimit && coupon.perUserLimit > 0) {
    const used = await CouponRedemption.countDocuments({ couponId: coupon._id, userId: decoded.id, membershipId });
    if (used >= coupon.perUserLimit) return res.status(400).json({ success: false, message: 'Límite de uso alcanzado' });
  }

  const membershipCurrency = membership.currency || 'PEN';
  const calc = computeDiscount({ membershipPrice: membership.price, membershipCurrency, coupon });
  if (!calc) return res.status(400).json({ success: false, message: 'Cupón no compatible con la moneda' });

  // Redondeo a 2 decimales para UI
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  return res.json({
    success: true,
    coupon: {
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.type,
      value: coupon.value,
      currency: coupon.currency || 'PEN'
    },
    pricing: {
      currency: membershipCurrency,
      original: round2(calc.original),
      discount: round2(calc.discount),
      final: round2(calc.final)
    }
  });
};

