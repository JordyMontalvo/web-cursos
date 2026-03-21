const mongoose = require('mongoose');

const REMOTA_URI = "mongodb+srv://iatibet:iatibet2025@atibet.u0vvt.mongodb.net/iatibet?retryWrites=true&w=majority&appName=atibet";

const episodeSchema = new mongoose.Schema({
    title: { type: String },
    videoUrl: { type: String },
    duration: { type: String }
});

const chapterSchema = new mongoose.Schema({
    title: { type: String },
    episodes: [episodeSchema]
});

const courseSchema = new mongoose.Schema({
    name: { type: String },
    chapters: [chapterSchema]
});

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

async function check() {
    try {
        await mongoose.connect(REMOTA_URI);
        const courses = await Course.find();
        courses.forEach(c => {
            console.log(`Course: ${c.name} (${c._id})`);
            (c.chapters || []).forEach(ch => {
                console.log(`  Chapter: ${ch.title}`);
                (ch.episodes || []).forEach(ep => {
                    console.log(`    Episode: ${ep.title} | URL: ${ep.videoUrl} | Dur: ${ep.duration}`);
                });
            });
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
