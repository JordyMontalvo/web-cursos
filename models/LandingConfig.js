const mongoose = require('mongoose');

const landingConfigSchema = new mongoose.Schema({
    heroTitle: { type: String, default: 'Aprende sin limites, crece sin barreras' },
    heroSubtitle: { type: String, default: 'Acceso completo a todos los cursos de la plataforma. Cancela cuando quieras. Sin contratos.' },
    heroTrustItems: [{ type: String }],
    featuresTitle: { type: String, default: 'Todo lo que obtienes con tu membresía' },
    featuresSubtitle: { type: String, default: 'Diseñado para que aprendas más rápido y avances en tu carrera' },
    features: [{
        icon: { type: String, default: '🎓' },
        title: { type: String, default: 'Cursos ilimitados' },
        description: { type: String, default: 'Accede a todos los cursos de la plataforma sin restricciones. Aprende a tu ritmo.' }
    }],
    faqTitle: { type: String, default: 'Preguntas frecuentes' },
    faqSubtitle: { type: String, default: 'Todo lo que necesitas saber antes de suscribirte' },
    faqs: [{
        question: { type: String, default: '' },
        answer: { type: String, default: '' }
    }],
    guaranteeTitle: { type: String, default: 'Garantía de satisfacción de 7 días' },
    guaranteeDescription: { type: String, default: 'Prueba nuestra plataforma sin riesgo. Si dentro de los primeros 7 días no estás completamente satisfecho, te devolvemos el 100% de tu dinero. Sin preguntas, sin complicaciones.' },
    guaranteeIcon: { type: String, default: '🛡️' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.LandingConfig || mongoose.model('LandingConfig', landingConfigSchema);
