const { connectDB } = require('./_db');
const Course = require('./_Course');

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error de conexión a DB', error: err.message });
    }

    const { id, chapterId, episodeId } = req.query;

    // ─── GET /api/courses ───────────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
        const courses = await Course.find().sort({ order: 1, createdAt: 1 });
        return res.json({ success: true, courses });
    }

    // ─── GET /api/courses?id=:id ────────────────────────────────────────────────
    if (req.method === 'GET' && id && !chapterId) {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        return res.json({ success: true, course });
    }

    // ─── POST /api/courses ──────────────────────────────────────────────────────
    if (req.method === 'POST' && !id) {
        const course = new Course({
            name: req.body.name,
            category: req.body.category,
            chapters: [],
            videoUrl: req.body.videoUrl || '',
            thumbnail: req.body.thumbnail || '/images/default-course.jpg',
            description: req.body.description || '',
            featured: req.body.featured === 'true' || req.body.featured === true,
            order: Number(req.body.order) || 0
        });
        await course.save();
        return res.json({ success: true, course });
    }

    // ─── PUT /api/courses?id=:id ────────────────────────────────────────────────
    if (req.method === 'PUT' && id && !chapterId) {
        const update = {
            name: req.body.name,
            category: req.body.category,
            videoUrl: req.body.videoUrl,
            thumbnail: req.body.thumbnail,
            description: req.body.description,
            featured: req.body.featured === 'true' || req.body.featured === true,
            order: req.body.order !== undefined ? Number(req.body.order) : undefined,
            updatedAt: Date.now()
        };
        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
        const course = await Course.findByIdAndUpdate(id, update, { new: true });
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        return res.json({ success: true, course });
    }

    // ─── DELETE /api/courses?id=:id ─────────────────────────────────────────────
    if (req.method === 'DELETE' && id && !chapterId) {
        const course = await Course.findByIdAndDelete(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        return res.json({ success: true, message: 'Curso eliminado' });
    }

    // ─── POST /api/courses?id=:id&chapterId=new ─────────────────────────────────
    if (req.method === 'POST' && id && chapterId === 'new') {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        course.chapters.push({
            title: req.body.title,
            description: req.body.description || '',
            order: course.chapters.length + 1,
            episodes: []
        });
        await course.save();
        const newChapter = course.chapters[course.chapters.length - 1];
        return res.json({ success: true, chapter: newChapter, course });
    }

    // ─── PUT /api/courses?id=:id&chapterId=:chapterId ───────────────────────────
    if (req.method === 'PUT' && id && chapterId && !episodeId) {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        const chapter = course.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
        if (req.body.title) chapter.title = req.body.title;
        if (req.body.description !== undefined) chapter.description = req.body.description;
        await course.save();
        return res.json({ success: true, chapter, course });
    }

    // ─── DELETE /api/courses?id=:id&chapterId=:chapterId ────────────────────────
    if (req.method === 'DELETE' && id && chapterId && !episodeId) {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        course.chapters.pull({ _id: chapterId });
        await course.save();
        return res.json({ success: true, message: 'Capítulo eliminado', course });
    }

    // ─── POST /api/courses?id=:id&chapterId=:chapterId&episodeId=new ─────────────
    if (req.method === 'POST' && id && chapterId && episodeId === 'new') {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        const chapter = course.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
        chapter.episodes.push({
            title: req.body.title,
            videoUrl: req.body.videoUrl,
            duration: req.body.duration || '',
            thumbnail: req.body.thumbnail || '',
            order: chapter.episodes.length + 1
        });
        await course.save();
        const newEp = chapter.episodes[chapter.episodes.length - 1];
        return res.json({ success: true, episode: newEp, course });
    }

    // ─── PUT /api/courses?id=:id&chapterId=:chapterId&episodeId=:episodeId ───────
    if (req.method === 'PUT' && id && chapterId && episodeId) {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        const chapter = course.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
        const episode = chapter.episodes.id(episodeId);
        if (!episode) return res.status(404).json({ success: false, message: 'Episodio no encontrado' });
        if (req.body.title) episode.title = req.body.title;
        if (req.body.videoUrl) episode.videoUrl = req.body.videoUrl;
        if (req.body.duration !== undefined) episode.duration = req.body.duration;
        if (req.body.thumbnail !== undefined) episode.thumbnail = req.body.thumbnail;
        await course.save();
        return res.json({ success: true, episode, course });
    }

    // ─── DELETE /api/courses?id=:id&chapterId=:chapterId&episodeId=:episodeId ────
    if (req.method === 'DELETE' && id && chapterId && episodeId) {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        const chapter = course.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
        chapter.episodes.pull({ _id: episodeId });
        await course.save();
        return res.json({ success: true, message: 'Episodio eliminado', course });
    }

    return res.status(405).json({ success: false, message: 'Ruta no encontrada' });
};
