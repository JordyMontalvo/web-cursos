const mongoose = require('mongoose');

const CouponRedemptionSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  orderId: { type: String, default: '' },
  redeemedAt: { type: Date, default: Date.now }
});

CouponRedemptionSchema.index({ couponId: 1, userId: 1, membershipId: 1 });
CouponRedemptionSchema.index({ orderId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', CouponRedemptionSchema);

