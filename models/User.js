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
    // Progreso de cursos del usuario (Objeto plano: {courseId: {ep_0: true, ...}})
    progress: {
        type: Object,
        default: {}
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

module.exports = mongoose.model('User', userSchema);
