const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    birthDate: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        required: false,   // opcional para usuarios OAuth
        minlength: 6
    },
    // OAuth fields
    googleId: {
        type: String,
        sparse: true
    },
    githubId: {
        type: String,
        sparse: true
    },
    avatar: {
        type: String,
        default: null
    },
    provider: {
        type: String,
        enum: ['local', 'google', 'github'],
        default: 'local'
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'vendedor'],
        default: 'user'
    },
    // Referral code (only for sellers)
    sellerCode: {
        type: String,
        unique: true,
        sparse: true
    },
    // Who referred this user
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Balance and metrics for sellers
    sellerBalance: {
        type: Number,
        default: 0
    },
    sellerCommission: {
        type: Number,
        default: 10 // default 10%
    },
    // Membership active of user
    activeMembership: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Membership',
        default: null
    },
    membershipExpiresAt: {
        type: Date,
        default: null
    },
    membershipPlan: {
        type: String,
        default: null
    },
    // ── Suscripción / Renovación automática ───────────────────────
    membershipAutoRenew: {
        type: Boolean,
        default: false
    },
    membershipCanceledAt: {
        type: Date,
        default: null
    },
    membershipCancelReason: {
        type: String,
        default: ''
    },
    // Token/alias para cobros recurrentes (si el PSP lo entrega)
    izipayPaymentMethodToken: {
        type: String,
        default: ''
    },
    izipayLastOrderId: {
        type: String,
        default: ''
    },
    // User progress
    progress: {
        type: Object,
        default: {}
    },
    // Admin Permissions (specific tabs)
    permissions: {
        type: [String],
        default: []
    },
    canCreate: { type: Boolean, default: true },
    canEdit: { type: Boolean, default: true },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password antes de guardar (Mongoose 9+ async sin next)
userSchema.pre('save', async function() {
    // Solo hashear si hay contraseña y fue modificada
    if (this.password && this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    this.updatedAt = Date.now();
});


// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false; // usuario OAuth sin contraseña
    return await bcrypt.compare(candidatePassword, this.password);
};

// Verificar si la membresía sigue activa
userSchema.methods.hasMembership = function() {
    if (!this.activeMembership) return false;
    if (!this.membershipExpiresAt) return false;
    return new Date() < this.membershipExpiresAt;
};

userSchema.methods.isAutoRenewEnabled = function() {
    return !!(this.membershipAutoRenew && this.izipayPaymentMethodToken && this.activeMembership && this.membershipExpiresAt);
};

module.exports = mongoose.model('User', userSchema);
