const mongoose = require('mongoose');

// Pago de membresía. Esquema único compartido por server.js y las funciones de Vercel (api/*.js).
const paymentSchema = new mongoose.Schema({
    orderId: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
    kind: { type: String, enum: ['checkout', 'renewal'], default: 'checkout' },
    status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'pending' },
    amountCents: { type: Number, default: 0 },
    currency: { type: String, default: '' },
    // Vinculación con el responsable comercial (Punto 10), fijada al registrar el pago:
    // salesOwnerId = quien trajo al cliente (referredBy), salesOwnerRole = su rol,
    // teamDirectorId = director del equipo al que pertenece la venta (null si es de la empresa).
    salesOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    salesOwnerRole: { type: String, enum: ['admin', 'director', 'vendedor', null], default: null },
    teamDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    raw: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
});
paymentSchema.index({ orderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ salesOwnerId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ teamDirectorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
