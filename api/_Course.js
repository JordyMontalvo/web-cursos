const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    duration: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 }
});

const chapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    episodes: [episodeSchema]
});

const courseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    thumbnail: { type: String, default: '/images/default-course.jpg' },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    chapters: [chapterSchema],
    order: { type: Number, default: 0 },
    totalChapters: { type: Number, default: 0 },
    totalEpisodes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

courseSchema.pre('save', async function() {
    if (this.chapters) {
        this.totalChapters = this.chapters.length;
        this.totalEpisodes = this.chapters.reduce((total, ch) => total + (ch.episodes ? ch.episodes.length : 0), 0);
    }
    this.updatedAt = Date.now();
});

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema);
