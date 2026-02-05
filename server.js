const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Archivo de base de datos JSON
const DB_FILE = './data/courses.json';

// Inicializar base de datos
function initDB() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            courses: [
                {
                    id: 1,
                    name: 'Inteligencia Artificial IA',
                    category: 'FINANZA',
                    chapters: 30,
                    episodes: 90,
                    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                    thumbnail: '/uploads/default-course.jpg',
                    description: 'Aprende los fundamentos de la Inteligencia Artificial',
                    featured: true,
                    createdAt: new Date().toISOString()
                }
            ],
            nextId: 2
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Leer base de datos
function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error leyendo base de datos:', error);
        return { courses: [], nextId: 1 };
    }
}

// Escribir base de datos
function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error escribiendo base de datos:', error);
        return false;
    }
}

// ===================================
// RUTAS DE LA API
// ===================================

// Obtener todos los cursos
app.get('/api/courses', (req, res) => {
    const db = readDB();
    res.json({ success: true, courses: db.courses });
});

// Obtener un curso por ID
app.get('/api/courses/:id', (req, res) => {
    const db = readDB();
    const course = db.courses.find(c => c.id === parseInt(req.params.id));
    
    if (course) {
        res.json({ success: true, course });
    } else {
        res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
});

// Obtener cursos destacados
app.get('/api/courses/featured', (req, res) => {
    const db = readDB();
    const featured = db.courses.filter(c => c.featured);
    res.json({ success: true, courses: featured });
});

// Crear nuevo curso
app.post('/api/courses', (req, res) => {
    const db = readDB();
    const newCourse = {
        id: db.nextId,
        name: req.body.name,
        category: req.body.category,
        chapters: parseInt(req.body.chapters) || 0,
        episodes: parseInt(req.body.episodes) || 0,
        videoUrl: req.body.videoUrl || '',
        thumbnail: req.body.thumbnail || '/uploads/default-course.jpg',
        description: req.body.description || '',
        featured: req.body.featured === 'true' || req.body.featured === true,
        createdAt: new Date().toISOString()
    };
    
    db.courses.push(newCourse);
    db.nextId++;
    
    if (writeDB(db)) {
        res.json({ success: true, course: newCourse });
    } else {
        res.status(500).json({ success: false, message: 'Error guardando curso' });
    }
});

// Actualizar curso
app.put('/api/courses/:id', (req, res) => {
    const db = readDB();
    const index = db.courses.findIndex(c => c.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    
    db.courses[index] = {
        ...db.courses[index],
        name: req.body.name || db.courses[index].name,
        category: req.body.category || db.courses[index].category,
        chapters: req.body.chapters !== undefined ? parseInt(req.body.chapters) : db.courses[index].chapters,
        episodes: req.body.episodes !== undefined ? parseInt(req.body.episodes) : db.courses[index].episodes,
        videoUrl: req.body.videoUrl || db.courses[index].videoUrl,
        thumbnail: req.body.thumbnail || db.courses[index].thumbnail,
        description: req.body.description || db.courses[index].description,
        featured: req.body.featured !== undefined ? (req.body.featured === 'true' || req.body.featured === true) : db.courses[index].featured,
        updatedAt: new Date().toISOString()
    };
    
    if (writeDB(db)) {
        res.json({ success: true, course: db.courses[index] });
    } else {
        res.status(500).json({ success: false, message: 'Error actualizando curso' });
    }
});

// Eliminar curso
app.delete('/api/courses/:id', (req, res) => {
    const db = readDB();
    const index = db.courses.findIndex(c => c.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    
    const deleted = db.courses.splice(index, 1);
    
    if (writeDB(db)) {
        res.json({ success: true, message: 'Curso eliminado', course: deleted[0] });
    } else {
        res.status(500).json({ success: false, message: 'Error eliminando curso' });
    }
});

// Subir imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
    }
    
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

// Inicializar servidor
initDB();

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
