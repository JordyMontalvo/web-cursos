const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const Course = require('./models/Course');
const User = require('./models/User');
const Membership = require('./models/Membership');
const Coupon = require('./models/Coupon');
const CouponRedemption = require('./models/CouponRedemption');
const Banner = require('./models/Banner');
const Settings = require('./models/Settings');
const Category = require('./models/Category');
const LandingConfig = require('./models/LandingConfig');


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

// Middleware de vendedor
function sellerMiddleware(req, res, next) {
    if (req.user.role !== 'vendedor' && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de vendedor.' });
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

        // Crear o actualizar admin
        const ADMIN_EMAIL = 'admin@iatibet.com';
        const ADMIN_PASSWORD = '123456';
        const hashedPw = await bcrypt.hash(ADMIN_PASSWORD, 12);
        
        // Buscamos por EMAIL para asegurar que es el usuario correcto
        await User.findOneAndUpdate(
            { email: ADMIN_EMAIL },
            {
                name: 'Administrador',
                email: ADMIN_EMAIL,
                password: hashedPw,
                role: 'admin',
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        console.log(`👤 Admin listo: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

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

        // Crear banners de ejemplo si no existen
        const bannerCount = await Banner.countDocuments();
        if (bannerCount === 0) {
            const defaultBanners = [
                {
                    title: 'IATIBET ZUREON',
                    subtitle: 'Transforma tu mente, finanzas y espíritu',
                    imageUrl: '/images/banner1.jpg',
                    linkUrl: '/',
                    order: 1,
                    isActive: true
                },
                {
                    title: 'Cursos Online Premium',
                    subtitle: 'Aprende con los mejores expertos del mundo',
                    imageUrl: '/images/banner2.jpg',
                    linkUrl: '/',
                    order: 2,
                    isActive: true
                },
                {
                    title: 'Únete a nuestra comunidad',
                    subtitle: 'Miles de estudiantes ya están transformando su vida',
                    imageUrl: '/images/banner3.jpg',
                    linkUrl: '/membresia',
                    order: 3,
                    isActive: true
                }
            ];
            await Banner.insertMany(defaultBanners);
            console.log('🖼️  Banners de ejemplo creados.');
        }

        // Crear configuración inicial si no existe
        const settingsCount = await Settings.countDocuments();
        if (settingsCount === 0) {
            const defaultSettings = new Settings({
                presentationVideoUrl: '',
                presentationVideoTitle: '',
                companyName: 'IATIBET ZUREON',
                logoUrl: ''
            });
            await defaultSettings.save();
            console.log('⚙️  Configuración inicial creada.');
        }

        // Crear categorías iniciales si no existen
        const categoryCount = await Category.countDocuments();
        if (categoryCount === 0) {
            const initialCategories = [
                { name: 'FINANZA' },
                { name: 'DESARROLLO' },
                { name: 'MARKETING' },
                { name: 'DISEÑO' },
                { name: 'NEGOCIOS' },
                { name: 'PERSONAL' }
            ];
            await Category.insertMany(initialCategories);
            console.log('📋 Categorías iniciales creadas.');
        }

        // Crear LandingConfig inicial si no existe
        const landingCount = await LandingConfig.countDocuments();
        if (landingCount === 0) {
            const defaultLanding = new LandingConfig({
                features: [
                    { icon: '🎓', title: 'Cursos ilimitados', description: 'Accede a todos los cursos de la plataforma sin restricciones. Aprende a tu ritmo.' },
                    { icon: '📱', title: 'Aprende donde quieras', description: 'Acceso desde cualquier dispositivo. PC, tablet o celular. Siempre disponible 24/7.' },
                    { icon: '🏆', title: 'Certificados verificados', description: 'Al completar cada curso obtienes un certificado de logro que puedes compartir en LinkedIn.' },
                    { icon: '🔔', title: 'Notificaciones de cursos', description: 'Recibe alertas cuando se publiquen nuevos cursos según tus intereses y categorías favoritas.' },
                    { icon: '💬', title: 'Comunidad exclusiva', description: 'Únete a nuestra comunidad privada de miembros. Resuelve dudas y conecta con otros alumnos.' },
                    { icon: '⚡', title: 'Contenido actualizado', description: 'Los cursos se actualizan constantemente con el contenido más reciente de cada industria.' }
                ],
                faqs: [
                    { question: '¿Puedo cancelar mi membresía en cualquier momento?', answer: 'Sí, puedes cancelar en cualquier momento desde tu perfil. Mantendrás el acceso hasta que venza tu periodo activo.' },
                    { question: '¿Cómo funciona la garantía de 7 días?', answer: 'Si dentro de los primeros 7 días no estás satisfecho con tu membresía, te devolvemos el dinero sin preguntas.' },
                    { question: '¿Cuántos dispositivos puedo usar simultáneamente?', answer: 'Puedes usar tu membresía en hasta 3 dispositivos al mismo tiempo.' },
                    { question: '¿Hay algún costo adicional por cursos nuevos?', answer: 'No. Tu membresía incluye acceso a todos los cursos presentes y futuros.' },
                    { question: '¿Cómo puedo pagar mi membresía?', answer: 'Aceptamos Yape, Plin, transferencia bancaria y tarjetas de crédito/débito.' }
                ]
            });
            await defaultLanding.save();
            console.log('📄 LandingConfig inicial creada.');
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
        const { name, email, password, country, phone, ref } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const adminEmail = 'admin@iatibet.com';
        if (email.toLowerCase() === adminEmail) {
            return res.status(403).json({ success: false, message: 'Este correo está reservado' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Este correo ya está registrado' });
        }

        // Buscar si hay un código de referido
        let referredById = null;
        if (ref) {
            const seller = await User.findOne({ sellerCode: ref, role: 'vendedor' });
            if (seller) {
                referredById = seller._id;
            }
        }

        const user = new User({ 
            name, 
            email: email.toLowerCase(), 
            password, 
            country, 
            phone,
            referredBy: referredById
        });
        await user.save();

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.setHeader('Cache-Control', 'no-store');
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

        res.setHeader('Cache-Control', 'no-store');
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
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            user: {
                ...user.toObject(),
                id: user._id,
                hasMembership: user.hasMembership()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Actualizar perfil de usuario
app.put('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const { name, lastName, phone, country, city, birthDate, currentPassword, newPassword } = req.body;

        if (name) user.name = name;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (country !== undefined) user.country = country;
        if (city !== undefined) user.city = city;
        if (birthDate !== undefined) user.birthDate = birthDate;

        if (currentPassword && newPassword) {
            const ok = await user.comparePassword(currentPassword);
            if (!ok) {
                return res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta' });
            }
            user.password = newPassword;
        }

        await user.save();
        const updatedUser = user.toObject();
        delete updatedUser.password;

        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente',
            user: { ...updatedUser, id: user._id, hasMembership: user.hasMembership() }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE BANNERS Y SETTINGS (PÚBLICAS)
// ===================================

app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Obtener todos los banners activos
app.get('/api/banners', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, banners });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE BANNERS Y SETTINGS (ADMIN)
// ===================================

// GET Settings
app.get('/api/admin/settings', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// PUT Settings
app.put('/api/admin/settings', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        if (req.body.presentationVideoUrl !== undefined) {
            settings.presentationVideoUrl = req.body.presentationVideoUrl;
        }
        if (req.body.presentationVideoTitle !== undefined) {
            settings.presentationVideoTitle = req.body.presentationVideoTitle;
        }
        if (req.body.companyName !== undefined) {
            settings.companyName = req.body.companyName;
        }
        if (req.body.logoUrl !== undefined) {
            settings.logoUrl = req.body.logoUrl;
        }
        if (req.body.membershipOfferBannerText !== undefined) {
            settings.membershipOfferBannerText = req.body.membershipOfferBannerText;
        }
        if (req.body.membershipOfferDurationHours !== undefined) {
            settings.membershipOfferDurationHours = Number(req.body.membershipOfferDurationHours) || 0;
        }
        if (req.body.membershipOfferDurationMinutes !== undefined) {
            settings.membershipOfferDurationMinutes = Number(req.body.membershipOfferDurationMinutes) || 0;
        }
        // Si el admin cambia duración, fijamos un fin GLOBAL desde "ahora" para todos
        if (req.body.membershipOfferDurationHours !== undefined || req.body.membershipOfferDurationMinutes !== undefined) {
            const h = Number(settings.membershipOfferDurationHours) || 0;
            const m = Number(settings.membershipOfferDurationMinutes) || 0;
            const durationMs = Math.max(0, h) * 3600000 + Math.max(0, m) * 60000;
            settings.membershipOfferEndsAt = durationMs > 0 ? new Date(Date.now() + durationMs) : null;
        }
        if (req.body.membershipShowFaq !== undefined) {
            settings.membershipShowFaq = Boolean(req.body.membershipShowFaq);
        }
        if (req.body.membershipOfferEndsAt !== undefined) {
            settings.membershipOfferEndsAt = req.body.membershipOfferEndsAt
                ? new Date(req.body.membershipOfferEndsAt)
                : null;
        }

        settings.updatedAt = new Date();
        await settings.save();

        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating settings', error: error.message });
    }
});

// Obtener todos los banners (admin)
app.get('/api/admin/banners', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1 });
        res.json({ success: true, banners });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Crear banner
app.post('/api/admin/banners', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, subtitle, imageUrl, linkUrl, order, isActive } = req.body;
        if (!imageUrl) {
            return res.status(400).json({ success: false, message: 'La URL de imagen es requerida' });
        }
        const banner = new Banner({
            title: title || '',
            subtitle: subtitle || '',
            imageUrl,
            linkUrl: linkUrl || '',
            order: Number(order) || 0,
            isActive: isActive !== false
        });
        await banner.save();
        res.json({ success: true, banner });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creando banner', error: error.message });
    }
});

// Actualizar banner
app.put('/api/admin/banners/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, subtitle, imageUrl, linkUrl, order, isActive } = req.body;
        const updateData = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = title;
        if (subtitle !== undefined) updateData.subtitle = subtitle;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
        if (order !== undefined) updateData.order = Number(order);
        if (isActive !== undefined) updateData.isActive = isActive;

        const banner = await Banner.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!banner) return res.status(404).json({ success: false, message: 'Banner no encontrado' });
        res.json({ success: true, banner });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando banner', error: error.message });
    }
});

// Eliminar banner
app.delete('/api/admin/banners/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner no encontrado' });
        res.json({ success: true, message: 'Banner eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando banner', error: error.message });
    }
});

// ===================================
// RUTAS DE LANDING CONFIG (PÚBLICAS)
// ===================================

app.get('/api/landing-config', async (req, res) => {
    try {
        let config = await LandingConfig.findOne();
        if (!config) config = await LandingConfig.create({});
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE LANDING CONFIG (ADMIN)
// ===================================

app.put('/api/admin/landing-config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            heroTitle, heroSubtitle, heroTrustItems,
            featuresTitle, featuresSubtitle, features,
            faqTitle, faqSubtitle, faqs,
            guaranteeTitle, guaranteeDescription, guaranteeIcon
        } = req.body;

        const updated = await LandingConfig.findOneAndUpdate(
            {},
            {
                $set: {
                    heroTitle: heroTitle || '',
                    heroSubtitle: heroSubtitle || '',
                    heroTrustItems: Array.isArray(heroTrustItems) ? heroTrustItems : [],
                    featuresTitle: featuresTitle || '',
                    featuresSubtitle: featuresSubtitle || '',
                    features: Array.isArray(features) ? features : [],
                    faqTitle: faqTitle || '',
                    faqSubtitle: faqSubtitle || '',
                    faqs: Array.isArray(faqs) ? faqs : [],
                    guaranteeTitle: guaranteeTitle || '',
                    guaranteeDescription: guaranteeDescription || '',
                    guaranteeIcon: guaranteeIcon || '🛡️',
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, config: updated, message: 'Configuración guardada' });
    } catch (error) {
        console.error('Save Landing Config Error:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
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
        const { name, description, price, currency, durationDays, badge, icon, color, buttonColor, features, isActive, order, sellerCommission } = req.body;
        if (!name || price === undefined || price === null) {
            return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos' });
        }
        const membership = new Membership({
            name, description, price: Number(price),
            currency: currency || 'PEN',
            durationDays: Number(durationDays) || 30,
            badge, icon, color, buttonColor, features: Array.isArray(features) ? features : [],
            isActive: isActive !== false,
            order: Number(order) || 0,
            sellerCommission: Number(sellerCommission) || 0
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
        const { name, description, price, currency, durationDays, badge, icon, color, buttonColor, features, isActive, order, sellerCommission } = req.body;
        const id = req.params.id;
        const updateData = { updatedAt: Date.now() };

        console.log(`[AdminServer] PUT /api/admin/memberships/${id} | Payload:`, JSON.stringify(req.body));

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = Number(price);
        if (currency !== undefined) updateData.currency = currency;
        if (durationDays !== undefined) updateData.durationDays = Number(durationDays);
        if (badge !== undefined) updateData.badge = badge;
        if (icon !== undefined) updateData.icon = icon;
        if (color !== undefined) updateData.color = color;
        if (buttonColor !== undefined) updateData.buttonColor = buttonColor;
        if (features !== undefined) updateData.features = Array.isArray(features) ? features : [];
        if (isActive !== undefined) updateData.isActive = isActive;
        if (order !== undefined) updateData.order = Number(order);
        if (sellerCommission !== undefined) updateData.sellerCommission = Number(sellerCommission);


        const membership = await Membership.findByIdAndUpdate(id, updateData, { new: true });
        if (!membership) {
            console.error(`[AdminServer] Membership not found: ${id}`);
            return res.status(404).json({ success: false, message: 'Plan no encontrado' });
        }

        console.log(`[AdminServer] Updated Membership: ${membership.name} (${membership.currency} ${membership.price})`);
        res.json({ success: true, membership });
    } catch (error) {
        console.error('[AdminServer] Error updating plan:', error);
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
// CUPONES (ADMIN + VALIDACIÓN)
// ===================================
function normalizeCouponCode(code) {
    return (code || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}
function couponNowInRange(startsAt, endsAt) {
    const now = Date.now();
    if (startsAt && now < new Date(startsAt).getTime()) return false;
    if (endsAt && now > new Date(endsAt).getTime()) return false;
    return true;
}
function computeCouponDiscount({ membershipPrice, membershipCurrency, coupon }) {
    const original = Number(membershipPrice) || 0;
    if (original <= 0) return { original, discount: 0, final: original };
    let discount = 0;
    if (coupon.type === 'percent') {
        const pct = Math.max(0, Math.min(100, Number(coupon.value) || 0));
        discount = (original * pct) / 100;
    } else {
        if ((coupon.currency || 'PEN') !== membershipCurrency) return null;
        discount = Number(coupon.value) || 0;
    }
    discount = Math.min(original, Math.max(0, discount));
    const final = Math.max(0, original - discount);
    return { original, discount, final };
}

// Listar cupones
app.get('/api/admin/coupons', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error', error: e.message });
    }
});

// Crear cupón
app.post('/api/admin/coupons', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const body = req.body || {};
        const code = normalizeCouponCode(body.code);
        const type = body.type;
        const value = Number(body.value);
        if (!code) return res.status(400).json({ success: false, message: 'Código requerido' });
        if (!['percent', 'fixed'].includes(type)) return res.status(400).json({ success: false, message: 'Tipo inválido' });
        if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ success: false, message: 'Valor inválido' });

        const doc = new Coupon({
            code,
            description: (body.description || '').toString(),
            type,
            value,
            currency: (body.currency || 'PEN').toString(),
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            isActive: body.isActive !== false,
            maxRedemptions: Number(body.maxRedemptions) || 0,
            perUserLimit: Number(body.perUserLimit) || 0,
            applicableMembershipIds: Array.isArray(body.applicableMembershipIds) ? body.applicableMembershipIds : [],
            updatedAt: new Date()
        });
        await doc.save();
        res.json({ success: true, coupon: doc });
    } catch (e) {
        if (e && e.code === 11000) return res.status(409).json({ success: false, message: 'Ese código ya existe' });
        res.status(500).json({ success: false, message: 'Error creando cupón', error: e.message });
    }
});

// Actualizar cupón
app.put('/api/admin/coupons/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const body = req.body || {};
        const update = { updatedAt: new Date() };
        if (body.code !== undefined) update.code = normalizeCouponCode(body.code);
        if (body.description !== undefined) update.description = (body.description || '').toString();
        if (body.type !== undefined) update.type = body.type;
        if (body.value !== undefined) update.value = Number(body.value);
        if (body.currency !== undefined) update.currency = (body.currency || 'PEN').toString();
        if (body.startsAt !== undefined) update.startsAt = body.startsAt ? new Date(body.startsAt) : null;
        if (body.endsAt !== undefined) update.endsAt = body.endsAt ? new Date(body.endsAt) : null;
        if (body.isActive !== undefined) update.isActive = !!body.isActive;
        if (body.maxRedemptions !== undefined) update.maxRedemptions = Number(body.maxRedemptions) || 0;
        if (body.perUserLimit !== undefined) update.perUserLimit = Number(body.perUserLimit) || 0;
        if (body.applicableMembershipIds !== undefined) update.applicableMembershipIds = Array.isArray(body.applicableMembershipIds) ? body.applicableMembershipIds : [];

        const doc = await Coupon.findByIdAndUpdate(id, update, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Cupón no encontrado' });
        res.json({ success: true, coupon: doc });
    } catch (e) {
        if (e && e.code === 11000) return res.status(409).json({ success: false, message: 'Ese código ya existe' });
        res.status(500).json({ success: false, message: 'Error actualizando cupón', error: e.message });
    }
});

// Eliminar cupón
app.delete('/api/admin/coupons/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error eliminando cupón', error: e.message });
    }
});

// Validar cupón (para el checkout)
app.post('/api/coupons/validate', authMiddleware, async (req, res) => {
    try {
        const { code, membershipId } = req.body || {};
        const c = normalizeCouponCode(code);
        if (!c) return res.status(400).json({ success: false, message: 'Ingresa un cupón' });
        if (!membershipId) return res.status(400).json({ success: false, message: 'Plan requerido' });

        const membership = await Membership.findById(membershipId);
        if (!membership) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

        const coupon = await Coupon.findOne({ code: c });
        if (!coupon || !coupon.isActive) return res.status(404).json({ success: false, message: 'Cupón inválido' });
        if (!couponNowInRange(coupon.startsAt, coupon.endsAt)) return res.status(400).json({ success: false, message: 'Cupón fuera de fecha' });
        if (coupon.maxRedemptions && coupon.maxRedemptions > 0 && (coupon.redeemedCount || 0) >= coupon.maxRedemptions) {
            return res.status(400).json({ success: false, message: 'Cupón agotado' });
        }
        if (coupon.applicableMembershipIds && coupon.applicableMembershipIds.length) {
            const ok = coupon.applicableMembershipIds.some(id => id.toString() === membershipId.toString());
            if (!ok) return res.status(400).json({ success: false, message: 'Cupón no aplica a este plan' });
        }
        if (req.user?.id && coupon.perUserLimit && coupon.perUserLimit > 0) {
            const used = await CouponRedemption.countDocuments({ couponId: coupon._id, userId: req.user.id, membershipId });
            if (used >= coupon.perUserLimit) return res.status(400).json({ success: false, message: 'Límite de uso alcanzado' });
        }

        const membershipCurrency = membership.currency || 'PEN';
        const calc = computeCouponDiscount({ membershipPrice: membership.price, membershipCurrency, coupon });
        if (!calc) return res.status(400).json({ success: false, message: 'Cupón no compatible con la moneda' });

        const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
        res.json({
            success: true,
            coupon: { code: coupon.code, description: coupon.description || '', type: coupon.type, value: coupon.value, currency: coupon.currency || 'PEN' },
            pricing: { currency: membershipCurrency, original: round2(calc.original), discount: round2(calc.discount), final: round2(calc.final) }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error', error: e.message });
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

app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, lastName, email, phone, country, password, role, sellerCode } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
        }

        const user = new User({
            name,
            lastName,
            email,
            phone,
            country,
            password,
            role: role || 'user',
            sellerCode: sellerCode || undefined
        });

        await user.save();
        res.json({ success: true, message: 'Usuario creado exitosamente', userId: user._id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear usuario', error: error.message });
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

        const hasMembership = user.hasMembership();
        const isAdmin = user.role === 'admin';
        const hasAccess = hasMembership || isAdmin;

        console.log(`[AccessCheck] User: ${user.email}, Role: ${user.role}, HasMembership: ${hasMembership}, HasAccess: ${hasAccess}`);

        res.json({
            success: true,
            hasAccess,
            hasMembership,
            membershipPlan: user.membershipPlan,
            membershipExpiresAt: user.membershipExpiresAt,
            role: user.role
        });
    } catch (error) {
        console.error('[AccessCheck] Error:', error);
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE CATEGORÍAS (ADMIN)
// ===================================

// Obtener todas las categorías (admin)
app.get('/api/admin/categories', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Crear categoría
app.post('/api/admin/categories', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
        
        const existing = await Category.findOne({ name: name.toUpperCase() });
        if (existing) return res.status(400).json({ success: false, message: 'La categoría ya existe' });

        const category = new Category({
            name: name.toUpperCase()
        });
        await category.save();
        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creando categoría', error: error.message });
    }
});

// Actualizar categoría
app.put('/api/admin/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const updateData = { updatedAt: Date.now() };
        if (name) updateData.name = name.toUpperCase();

        const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!category) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error actualizando categoría', error: error.message });
    }
});

// Eliminar categoría
app.delete('/api/admin/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
        res.json({ success: true, message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error eliminando categoría', error: error.message });
    }
});

// ===================================
// RUTAS DE CATEGORÍAS (PÚBLICAS)
// ===================================

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE LA API - CURSOS
// ===================================

app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1, order: 1 });
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo cursos', error: error.message });
    }
});

app.get('/api/courses/featured', async (req, res) => {
    try {
        const featured = await Course.find({ featured: true }).sort({ createdAt: -1, order: 1 });
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
        const esp = ['basico', 'intermedio', 'avanzado'].includes(req.body.especializacion)
            ? req.body.especializacion
            : 'basico';
        const newCourse = new Course({
            name: req.body.name,
            category: req.body.category,
            especializacion: esp,
            chapters: [],
            totalChapters: parseInt(req.body.chapters) || 0,
            totalEpisodes: parseInt(req.body.episodes) || 0,
            videoUrl: req.body.videoUrl || '',
            thumbnail: req.body.thumbnail || '/images/default-course.jpg',
            description: req.body.description || '',
            featured: req.body.featured === 'true' || req.body.featured === true,
            order: Number(req.body.order) || 0
        });
        await newCourse.save();
        res.json({ success: true, course: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error guardando curso', error: error.message });
    }
});

app.put('/api/courses/:id', async (req, res) => {
    try {
        const esp = ['basico', 'intermedio', 'avanzado'].includes(req.body.especializacion)
            ? req.body.especializacion
            : 'basico';
        const updateData = {
            name: req.body.name,
            category: req.body.category,
            especializacion: esp,
            videoUrl: req.body.videoUrl,
            thumbnail: req.body.thumbnail,
            description: req.body.description,
            featured: req.body.featured === 'true' || req.body.featured === true,
            order: req.body.order !== undefined ? Number(req.body.order) : undefined,
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
            thumbnail: req.body.thumbnail || '',
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
        if (req.body.duration !== undefined) episode.duration = req.body.duration;
        if (req.body.description !== undefined) episode.description = req.body.description;
        if (req.body.thumbnail !== undefined) episode.thumbnail = req.body.thumbnail;
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
app.get('/perfil', (req, res) => res.sendFile(path.join(__dirname, 'public', 'perfil.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/curso/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'curso.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/content/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'content-manager.html')));
app.get('/vendedor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vendedor.html')));

// ===================================
// RUTAS DE VENDEDORES (SELLER PANEL)
// ===================================

// Estadísticas del vendedor
app.get('/api/seller/stats', authMiddleware, sellerMiddleware, async (req, res) => {
    try {
        const seller = await User.findById(req.user.id);
        if (!seller) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });

        const count = await User.countDocuments({ referredBy: seller._id });
        
        res.json({
            success: true,
            stats: {
                balance: seller.sellerBalance || 0,
                referralsCount: count,
                code: seller.sellerCode,
                commission: seller.sellerCommission || 10
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Lista de referidos del vendedor
app.get('/api/seller/referrals', authMiddleware, sellerMiddleware, async (req, res) => {
    try {
        const referrals = await User.find({ referredBy: req.user.id })
            .select('name lastName email phone country createdAt membershipPlan membershipExpiresAt activeMembership')
            .sort({ createdAt: -1 });
        
        const results = referrals.map(u => ({
            ...u.toObject(),
            hasMembership: !!(u.activeMembership && u.membershipExpiresAt && new Date() < u.membershipExpiresAt)
        }));

        res.json({ success: true, referrals: results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// ===================================
// RUTAS DE ADMINISTRACIÓN DE VENDEDORES
// ===================================

// Obtener todos los vendedores
app.get('/api/admin/vendedores', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const vendedores = await User.find({ role: 'vendedor' }).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, vendedores });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
});

// Crear un vendedor
app.post('/api/admin/vendedores', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, email, password, sellerCode } = req.body;
        
        if (!name || !email || !password || !sellerCode) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(400).json({ success: false, message: 'El correo ya existe' });

        const existingCode = await User.findOne({ sellerCode });
        if (existingCode) return res.status(400).json({ success: false, message: 'El código de vendedor ya está en uso' });

        const hashedPw = await bcrypt.hash(password, 12);
        const vendedor = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPw,
            role: 'vendedor',
            sellerCode
        });

        await vendedor.save();
        res.json({ success: true, vendedor: { id: vendedor._id, name: vendedor.name, email: vendedor.email, sellerCode: vendedor.sellerCode } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creando vendedor', error: error.message });
    }
});

// Eliminar/Desactivar vendedor
app.delete('/api/admin/vendedores/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'vendedor') return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
        
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Vendedor eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
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
