const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Banner', bannerSchema);
