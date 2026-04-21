const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    presentationVideoUrl: { type: String, default: '' },
    presentationVideoTitle: { type: String, default: '' },
    companyName: { type: String, default: 'IATIBET ZUREON' },
    logoUrl: { type: String, default: '' },
    /** Texto del banner de oferta en /membresia (vacío = texto por defecto del sitio) */
    membershipOfferBannerText: { type: String, default: '' },
    /** Duración de la promo para el contador (0 = desactivado) */
    membershipOfferDurationHours: { type: Number, default: 0, min: 0, max: 168 },
    membershipOfferDurationMinutes: { type: Number, default: 0, min: 0, max: 59 },
    /** Fin de la oferta (contador). null = usar contador por sesión (localStorage) */
    membershipOfferEndsAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
