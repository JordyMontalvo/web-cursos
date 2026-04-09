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
    currency: { type: String, enum: ['PEN', 'USD'], default: 'PEN' }, // usado si type=fixed
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    maxRedemptions: { type: Number, default: 0 }, // 0 = ilimitado
    redeemedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 0 }, // 0 = ilimitado
    applicableMembershipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Membership' }], // vacío = todos
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  schema.index({ code: 1 }, { unique: true });
  Coupon = mongoose.model('Coupon', schema);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

function normalizeCode(code) {
  return (code || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = verifyAdmin(req);
  if (!admin) return res.status(403).json({ success: false, message: 'Acceso denegado' });

  try { await connectDB(); } catch {
    return res.status(500).json({ success: false, message: 'DB error' });
  }

  const url = req.url.split('?')[0];
  const parts = url.split('/').filter(Boolean);
  let id = req.query?.id;
  if (!id) {
    id = parts[parts.length - 1];
    if (id === 'coupons' || id === 'admin-coupons') id = null;
  }

  // GET /api/admin/coupons
  if (req.method === 'GET') {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json({ success: true, coupons });
  }

  // POST /api/admin/coupons
  if (req.method === 'POST') {
    const body = req.body || {};
    const code = normalizeCode(body.code);
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
      updatedAt: Date.now()
    });

    try {
      await doc.save();
    } catch (e) {
      if (e && e.code === 11000) return res.status(409).json({ success: false, message: 'Ese código ya existe' });
      return res.status(500).json({ success: false, message: 'No se pudo crear el cupón' });
    }

    return res.json({ success: true, coupon: doc });
  }

  // PUT /api/admin/coupons/:id
  if (req.method === 'PUT' && id) {
    const body = req.body || {};
    const update = { updatedAt: Date.now() };
    if (body.code !== undefined) update.code = normalizeCode(body.code);
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
      return res.status(500).json({ success: false, message: 'No se pudo actualizar el cupón' });
    }
  }

  // DELETE /api/admin/coupons/:id
  if (req.method === 'DELETE' && id) {
    await Coupon.findByIdAndDelete(id);
    return res.json({ success: true });
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};

