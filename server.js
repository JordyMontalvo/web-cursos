const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Course = require('./models/Course');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a MongoDB
// Configuración de bases de datos
const REMOTA_URI = 'mongodb://admin:ADMIN_sifrah@ec2-18-220-240-71.us-east-2.compute.amazonaws.com:27017/cursos_db?authSource=admin';
const LOCAL_URI = 'mongodb://localhost:27017/cursos_db';

// ==========================================
// ⚙️ SELECCIÓN DE BASE DE DATOS
// Usa la variable de entorno USE_LOCAL_DB=true para conectar a local
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';
// ==========================================

const MONGODB_URI = USE_LOCAL_DB ? LOCAL_URI : REMOTA_URI;

// Función para sembrar la base de datos si está vacía
async function seedDatabase() {
    try {
        const count = await Course.countDocuments();
        if (count === 0) {
            console.log('🌱 Base de datos vacía. Sembrando datos iniciales...');
            
            const initialCourse = new Course({
                name: 'Inteligencia Artificial IA',
                category: 'FINANZA',
                thumbnail: '/images/default-course.jpg', // Asegúrate de que esta imagen exista o usa una URL externa temporal
                description: 'Aprende los fundamentos de la Inteligencia Artificial',
                featured: true,
                chapters: [
                    {
                        title: 'Introducción a la IA',
                        description: 'Conceptos básicos',
                        order: 1,
                        episodes: [
                            {
                                title: '¿Qué es la IA?',
                                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Video de prueba
                                duration: '10:00',
                                order: 1
                            }
                        ]
                    }
                ]
            });

            await initialCourse.save();
            console.log('✅ Datos iniciales creados correctamente.');
        } else {
            console.log(`📚 Base de datos ya contiene ${count} cursos.`);
        }
    } catch (error) {
        console.error('❌ Error sembrando base de datos:', error);
    }
}

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log(`✅ Conectado a MongoDB: ${USE_LOCAL_DB ? 'LOCAL 🏠' : 'REMOTA ☁️'}`);
        await seedDatabase();
    })
    .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Servir archivos estáticos
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configurar multer para subir imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB límite
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// ===================================
// RUTAS DE LA API
// ===================================

// Obtener todos los cursos
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo cursos', error: error.message });
    }
});

// Obtener un curso por ID
app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (course) {
            res.json({ success: true, course });
        } else {
            res.status(404).json({ success: false, message: 'Curso no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo curso', error: error.message });
    }
});

// Obtener cursos destacados
app.get('/api/courses/featured', async (req, res) => {
    try {
        const featured = await Course.find({ featured: true }).sort({ createdAt: -1 });
        res.json({ success: true, courses: featured });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo cursos destacados', error: error.message });
    }
});

// Crear nuevo curso
app.post('/api/courses', async (req, res) => {
    try {
        const newCourse = new Course({
            name: req.body.name,
            category: req.body.category,
            // chapters y episodes se calculan automáticamente al añadir contenido
            chapters: [],
            totalChapters: parseInt(req.body.chapters) || 0, // Mantener compatibilidad inicial
            totalEpisodes: parseInt(req.body.episodes) || 0, // Mantener compatibilidad inicial
            videoUrl: req.body.videoUrl || '',
            thumbnail: req.body.thumbnail || '/images/default-course.jpg',
            description: req.body.description || '',
            featured: req.body.featured === 'true' || req.body.featured === true
        });

        await newCourse.save();
        res.json({ success: true, course: newCourse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error guardando curso', error: error.message });
    }
});

// Actualizar curso general
app.put('/api/courses/:id', async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            category: req.body.category,
            videoUrl: req.body.videoUrl,
            thumbnail: req.body.thumbnail,
            description: req.body.description,
            featured: req.body.featured === 'true' || req.body.featured === true,
            updatedAt: Date.now()
        };
        
        // Si se envían manualmente chapters/episodes (legacy), actualizarlos si es necesario
        if (req.body.chapters) updateData.totalChapters = parseInt(req.body.chapters);
        if (req.body.episodes) updateData.totalEpisodes = parseInt(req.body.episodes);

        // Eliminar campos undefined/null para no sobrescribir con null
        Object.keys(updateData).forEach(key => key !== 'thumbnail' && (updateData[key] === undefined || updateData[key] === '') && delete updateData[key]);
        if (updateData.thumbnail === '') delete updateData.thumbnail;

        const course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true });
        
        if (course) {
            res.json({ success: true, course });
        } else {
            res.status(404).json({ success: false, message: 'Curso no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando curso', error: error.message });
    }
});

// Eliminar curso
app.delete('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (course) {
            res.json({ success: true, message: 'Curso eliminado', course });
        } else {
            res.status(404).json({ success: false, message: 'Curso no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando curso', error: error.message });
    }
});

// ===================================
// GESTIÓN DE CONTENIDO (CAPÍTULOS Y EPISODIOS)
// ===================================

// Agregar un capítulo a un curso
app.post('/api/courses/:id/chapters', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        const newChapter = {
            title: req.body.title,
            description: req.body.description,
            order: req.body.order || (course.chapters.length + 1),
            episodes: []
        };

        course.chapters.push(newChapter);
        await course.save();

        res.json({ success: true, chapter: course.chapters[course.chapters.length - 1], course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error agregando capítulo', error: error.message });
    }
});

// Actualizar un capítulo
app.put('/api/courses/:courseId/chapters/:chapterId', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });

        if (req.body.title) chapter.title = req.body.title;
        if (req.body.description) chapter.description = req.body.description;
        if (req.body.order) chapter.order = req.body.order;

        await course.save();
        res.json({ success: true, chapter, course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando capítulo', error: error.message });
    }
});

// Eliminar un capítulo
app.delete('/api/courses/:courseId/chapters/:chapterId', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        // En Mongoose 5+, pull funciona así par arrays de subdocumentos, o se usa el método de array
        course.chapters.pull({ _id: req.params.chapterId }); 
        await course.save();

        res.json({ success: true, message: 'Capítulo eliminado', course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando capítulo', error: error.message });
    }
});

// Agregar episodio a un capítulo
// Nota: Es mejor buscar por courseId, luego encontrar chapterId
app.post('/api/courses/:courseId/chapters/:chapterId/episodes', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });

        const newEpisode = {
            title: req.body.title,
            videoUrl: req.body.videoUrl,
            duration: req.body.duration,
            description: req.body.description,
            order: req.body.order || (chapter.episodes.length + 1)
        };

        chapter.episodes.push(newEpisode);
        await course.save();

        res.json({ success: true, episode: chapter.episodes[chapter.episodes.length - 1], course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error agregando episodio', error: error.message });
    }
});

// Actualizar episodio
app.put('/api/courses/:courseId/chapters/:chapterId/episodes/:episodeId', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });

        const episode = chapter.episodes.id(req.params.episodeId);
        if (!episode) return res.status(404).json({ success: false, message: 'Episodio no encontrado' });

        if (req.body.title) episode.title = req.body.title;
        if (req.body.videoUrl) episode.videoUrl = req.body.videoUrl;
        if (req.body.duration) episode.duration = req.body.duration;
        if (req.body.description) episode.description = req.body.description;
        if (req.body.order) episode.order = req.body.order;

        await course.save();
        res.json({ success: true, episode, course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando episodio', error: error.message });
    }
});

// Eliminar episodio
app.delete('/api/courses/:courseId/chapters/:chapterId/episodes/:episodeId', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });

        chapter.episodes.pull({ _id: req.params.episodeId });
        await course.save();

        res.json({ success: true, message: 'Episodio eliminado', course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando episodio', error: error.message });
    }
});


// Subir imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
    }
    
    // Devolvemos la URL relativa
    const imageUrl = '/uploads/' + req.file.filename;
    res.json({ success: true, imageUrl });
});

// ===================================
// RUTAS DE PÁGINAS
// ===================================

// Página principal (index.html desde public)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Página de curso
app.get('/curso/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'curso.html'));
});

// Panel de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 IATIBET ZUREON - Plataforma de Cursos          ║
║                                                       ║
║   Servidor corriendo en:                             ║
║   📍 http://localhost:${PORT}                         ║
║                                                       ║
║   Panel de Administración:                           ║
║   🔧 http://localhost:${PORT}/admin                   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});
