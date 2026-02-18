const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    videoUrl: {
        type: String,
        required: true
    },
    duration: String,
    description: String,
    order: Number
});

const chapterSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    order: Number,
    episodes: [episodeSchema]
});

const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        default: '/images/default-course.jpg'
    },
    description: String,
    videoUrl: String, // Tráiler o video principal del curso
    featured: {
        type: Boolean,
        default: false
    },
    chapters: [chapterSchema], // Contenido del curso (temario)
    totalChapters: {
        type: Number,
        default: 0
    },
    totalEpisodes: {
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

// Middleware para actualizar totalChapters y totalEpisodes antes de guardar
courseSchema.pre('save', async function() {
    if (this.chapters) {
        this.totalChapters = this.chapters.length;
        this.totalEpisodes = this.chapters.reduce((total, chapter) => {
            return total + (chapter.episodes ? chapter.episodes.length : 0);
        }, 0);
    }
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Course', courseSchema);
