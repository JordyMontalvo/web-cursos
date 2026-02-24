const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    // Membresía activa del usuario
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
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
    this.updatedAt = Date.now();
});


// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Verificar si la membresía sigue activa
userSchema.methods.hasMembership = function() {
    if (!this.activeMembership) return false;
    if (!this.membershipExpiresAt) return false;
    return new Date() < this.membershipExpiresAt;
};

module.exports = mongoose.model('User', userSchema);
