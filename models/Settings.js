const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    presentationVideoUrl: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
