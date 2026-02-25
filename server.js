const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Course = require('./models/Course');
const User = require('./models/User');
const Membership = require('./models/Membership');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_secret_2024';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a MongoDB
const REMOTA_URI = 'mongodb://admin:ADMIN_sifrah@ec2-18-220-240-71.us-east-2.compute.amazonaws.com:27017/cursos_db?authSource=admin';
const LOCAL_URI = 'mongodb://localhost:27017/cursos_db';
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';
const MONGODB_URI = USE_LOCAL_DB ? LOCAL_URI : REMOTA_URI;

// Middleware de autenticación JWT
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    }
}

// Middleware de admin
function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
}

// Función para sembrar la base de datos
async function seedDatabase() {
    try {
        const count = await Course.countDocuments();
        if (count === 0) {
            console.log('🌱 Base de datos vacía. Sembrando datos iniciales...');
            const initialCourse = new Course({
                name: 'Inteligencia Artificial IA',
                category: 'FINANZA',
                thumbnail: '/images/default-course.jpg',
                description: 'Aprende los fundamentos de la Inteligencia Artificial',
                featured: true,
                chapters: [{
                    title: 'Introducción a la IA',
                    description: 'Conceptos básicos',
                    order: 1,
                    episodes: [{
                        title: '¿Qué es la IA?',
                        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                        duration: '10:00',
                        order: 1
                    }]
                }]
            });
            await initialCourse.save();
            console.log('✅ Datos iniciales creados correctamente.');
        }

        // Crear admin por defecto si no existe
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const admin = new User({
                name: 'Administrador',
                email: 'admin@iatibet.com',
                password: 'admin123',
                role: 'admin'
            });
            await admin.save();
            console.log('👤 Admin creado: admin@iatibet.com / admin123');
        }

        // Crear membresías de ejemplo si no existen
        const membCount = await Membership.countDocuments();
        if (membCount === 0) {
            const defaultMemberships = [
                {
                    name: 'Básico',
                    description: 'Perfecto para comenzar tu camino de aprendizaje',
                    price: 29,
                    durationDays: 30,
                    color: '#3B82F6',
                    features: ['Acceso a todos los cursos', 'Soporte por email', 'Certificados de finalización'],
                    order: 1
                },
                {
                    name: 'Pro',
                    description: 'El plan más popular para aprendices serios',
                    price: 79,
                    durationDays: 30,
                    badge: 'Más Popular',
                    color: '#7C3AED',
                    features: ['Todo lo del plan Básico', 'Acceso prioritario a nuevos cursos', 'Comunidad exclusiva VIP', 'Mentoría mensual en vivo'],
                    order: 2
                },
                {
                    name: 'Anual',
                    description: 'Máximo valor, acceso por un año completo',
                    price: 199,
                    durationDays: 365,
                    badge: 'Mejor Valor',
                    color: '#10B981',
                    features: ['Todo lo del plan Pro', 'Ahorra más del 50%', 'Descargable para ver offline', 'Acceso a materiales extra exclusivos'],
                    order: 3
                }
            ];
            await Membership.insertMany(defaultMemberships);
            console.log('💎 Membresías de ejemplo creadas.');
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

// Configurar multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// ===================================
// RUTAS DE AUTENTICACIÓN
// ===================================

// Registro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Este correo ya está registrado' });
        }

        const user = new User({ name, email, password });
        await user.save();

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hasMembership: false,
                membershipPlan: null,
                membershipExpiresAt: null
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al registrar usuario', error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hasMembership: user.hasMembership(),
                membershipPlan: user.membershipPlan,
                membershipExpiresAt: user.membershipExpiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al iniciar sesión', error: error.message });
    }
});

// Perfil del usuario autenticado
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hasMembership: user.hasMembership(),
                membershipPlan: user.membershipPlan,
                membershipExpiresAt: user.membershipExpiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE MEMBRESÍAS (PÚBLICAS)
// ===================================

// Obtener todos los planes activos
app.get('/api/memberships', async (req, res) => {
    try {
        const memberships = await Membership.find({ isActive: true }).sort({ order: 1, price: 1 });
        res.json({ success: true, memberships });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Suscribirse a un plan (usuario autenticado)
app.post('/api/memberships/subscribe', authMiddleware, async (req, res) => {
    try {
        const { membershipId } = req.body;
        const membership = await Membership.findById(membershipId);
        if (!membership || !membership.isActive) {
            return res.status(404).json({ success: false, message: 'Plan de membresía no encontrado' });
        }

        // Calcular duración
        let expiresAt = null;
        if (membership.durationDays > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + membership.durationDays);
        } else {
            // De por vida: 100 años
            expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 100);
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                activeMembership: membership._id,
                membershipPlan: membership.name,
                membershipExpiresAt: expiresAt,
                updatedAt: new Date()
            },
            { new: true }
        );

        res.json({
            success: true,
            message: '¡Membresía activada exitosamente!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hasMembership: user.hasMembership(),
                membershipPlan: user.membershipPlan,
                membershipExpiresAt: user.membershipExpiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al activar membresía', error: error.message });
    }
});

// ===================================
// RUTAS DE MEMBRESÍAS (ADMIN)
// ===================================

// Obtener todos los planes (admin)
app.get('/api/admin/memberships', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const memberships = await Membership.find().sort({ order: 1, price: 1 });
        res.json({ success: true, memberships });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Crear plan
app.post('/api/admin/memberships', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, description, price, durationDays, badge, color, features, isActive, order } = req.body;
        if (!name || price === undefined || price === null) {
            return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos' });
        }
        const membership = new Membership({
            name, description, price: Number(price),
            durationDays: Number(durationDays) || 30,
            badge, color, features: Array.isArray(features) ? features : [],
            isActive: isActive !== false,
            order: Number(order) || 0
        });
        await membership.save();
        res.json({ success: true, membership });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creando plan', error: error.message });
    }
});

// Actualizar plan
app.put('/api/admin/memberships/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, description, price, durationDays, badge, color, features, isActive, order } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = Number(price);
        if (durationDays !== undefined) updateData.durationDays = Number(durationDays);
        if (badge !== undefined) updateData.badge = badge;
        if (color !== undefined) updateData.color = color;
        if (features !== undefined) updateData.features = Array.isArray(features) ? features : [];
        if (isActive !== undefined) updateData.isActive = isActive;
        if (order !== undefined) updateData.order = Number(order);

        const membership = await Membership.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        res.json({ success: true, membership });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando plan', error: error.message });
    }
});

// Eliminar plan
app.delete('/api/admin/memberships/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const membership = await Membership.findByIdAndDelete(req.params.id);
        if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        res.json({ success: true, message: 'Plan eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando plan', error: error.message });
    }
});

// ===================================
// RUTAS DE USUARIOS (ADMIN)
// ===================================

// Obtener todos los usuarios
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Actualizar membresía de un usuario (admin)
app.put('/api/admin/users/:id/membership', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { membershipId, action } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        if (action === 'revoke') {
            user.activeMembership = null;
            user.membershipPlan = null;
            user.membershipExpiresAt = null;
        } else if (membershipId) {
            const membership = await Membership.findById(membershipId);
            if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

            let expiresAt = new Date();
            if (membership.durationDays > 0) {
                expiresAt.setDate(expiresAt.getDate() + membership.durationDays);
            } else {
                expiresAt.setFullYear(expiresAt.getFullYear() + 100);
            }
            user.activeMembership = membership._id;
            user.membershipPlan = membership.name;
            user.membershipExpiresAt = expiresAt;
        }
        await user.save();
        res.json({ success: true, message: 'Membresía actualizada', user: { ...user.toObject(), password: undefined } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Verificar acceso a curso (para el frontend de curso)
app.get('/api/auth/check-access', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const hasAccess = user.hasMembership() || user.role === 'admin';
        res.json({
            success: true,
            hasAccess,
            hasMembership: user.hasMembership(),
            membershipPlan: user.membershipPlan,
            membershipExpiresAt: user.membershipExpiresAt,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE LA API - CURSOS
// ===================================

app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo cursos', error: error.message });
    }
});

app.get('/api/courses/featured', async (req, res) => {
    try {
        const featured = await Course.find({ featured: true }).sort({ createdAt: -1 });
        res.json({ success: true, courses: featured });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (course) res.json({ success: true, course });
        else res.status(404).json({ success: false, message: 'Curso no encontrado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

app.post('/api/courses', async (req, res) => {
    try {
        const newCourse = new Course({
            name: req.body.name,
            category: req.body.category,
            chapters: [],
            totalChapters: parseInt(req.body.chapters) || 0,
            totalEpisodes: parseInt(req.body.episodes) || 0,
            videoUrl: req.body.videoUrl || '',
            thumbnail: req.body.thumbnail || '/images/default-course.jpg',
            description: req.body.description || '',
            featured: req.body.featured === 'true' || req.body.featured === true
        });
        await newCourse.save();
        res.json({ success: true, course: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error guardando curso', error: error.message });
    }
});

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
        if (req.body.chapters) updateData.totalChapters = parseInt(req.body.chapters);
        if (req.body.episodes) updateData.totalEpisodes = parseInt(req.body.episodes);
        Object.keys(updateData).forEach(key => key !== 'thumbnail' && (updateData[key] === undefined || updateData[key] === '') && delete updateData[key]);
        if (updateData.thumbnail === '') delete updateData.thumbnail;

        const course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (course) res.json({ success: true, course });
        else res.status(404).json({ success: false, message: 'Curso no encontrado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

app.delete('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (course) res.json({ success: true, message: 'Curso eliminado', course });
        else res.status(404).json({ success: false, message: 'Curso no encontrado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Capítulos
app.post('/api/courses/:id/chapters', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        course.chapters.push({
            title: req.body.title,
            description: req.body.description,
            order: req.body.order || (course.chapters.length + 1),
            episodes: []
        });
        await course.save();
        res.json({ success: true, chapter: course.chapters[course.chapters.length - 1], course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

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
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

app.delete('/api/courses/:courseId/chapters/:chapterId', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        course.chapters.pull({ _id: req.params.chapterId });
        await course.save();
        res.json({ success: true, message: 'Capítulo eliminado', course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Episodios
app.post('/api/courses/:courseId/chapters/:chapterId/episodes', async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
        chapter.episodes.push({
            title: req.body.title,
            videoUrl: req.body.videoUrl,
            duration: req.body.duration,
            description: req.body.description,
            order: req.body.order || (chapter.episodes.length + 1)
        });
        await course.save();
        res.json({ success: true, episode: chapter.episodes[chapter.episodes.length - 1], course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

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
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

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
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Subir imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
    res.json({ success: true, imageUrl: '/uploads/' + req.file.filename });
});

// ===================================
// RUTAS DE PÁGINAS
// ===================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/membresia', (req, res) => res.sendFile(path.join(__dirname, 'public', 'membresia.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/curso/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'curso.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/content/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'content-manager.html')));

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 IATIBET ZUREON - Plataforma de Cursos          ║
║                                                       ║
║   Servidor corriendo en:                             ║
║   📍 http://localhost:${PORT}                         ║
║                                                       ║
║   🔐 Login: http://localhost:${PORT}/login            ║
║   📋 Register: http://localhost:${PORT}/register      ║
║   💎 Membresías: http://localhost:${PORT}/membresia   ║
║   🔧 Admin: http://localhost:${PORT}/admin            ║
║                                                       ║
║   Admin por defecto:                                 ║
║   📧 admin@iatibet.com  🔑 admin123                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});
