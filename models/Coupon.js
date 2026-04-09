const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
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

CouponSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);

