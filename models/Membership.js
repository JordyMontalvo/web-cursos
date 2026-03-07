const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['PEN', 'USD'],
        default: 'PEN'
    },
    // Duración en días (30 = mensual, 365 = anual, 0 = de por vida)
    durationDays: {
        type: Number,
        required: true,
        default: 30
    },
    // Badge que se muestra en la UI
    badge: {
        type: String,
        default: '' // Ej: "Más Popular", "Mejor Valor"
    },
    // Color del plan (para la UI)
    color: {
        type: String,
        default: '#7C3AED'
    },
    // Features / beneficios del plan
    features: [{
        type: String
    }],
    // Si el plan está activo y disponible para compra
    isActive: {
        type: Boolean,
        default: true
    },
    // Orden de visualización
    order: {
        type: Number,
        default: 0
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

membershipSchema.pre('save', function () {
    this.updatedAt = Date.now();
});


// Helper para descripción de duración
membershipSchema.virtual('durationLabel').get(function () {
    if (this.durationDays === 0) return 'De por vida';
    if (this.durationDays === 365) return '1 año';
    if (this.durationDays === 30) return '1 mes';
    if (this.durationDays === 7) return '1 semana';
    return `${this.durationDays} días`;
});

module.exports = mongoose.model('Membership', membershipSchema);
