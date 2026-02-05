const fs = require('fs');
const path = require('path');

const DB_FILE = path.join('/tmp', 'courses.json');

// Inicializar base de datos
function initDB() {
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
        initDB();
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

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const db = readDB();
    
    // GET all courses
    if (req.method === 'GET' && !req.query.id) {
        return res.status(200).json({ success: true, courses: db.courses });
    }
    
    // GET single course
    if (req.method === 'GET' && req.query.id) {
        const course = db.courses.find(c => c.id === parseInt(req.query.id));
        if (course) {
            return res.status(200).json({ success: true, course });
        } else {
            return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        }
    }
    
    // POST - Create course
    if (req.method === 'POST') {
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
            return res.status(200).json({ success: true, course: newCourse });
        } else {
            return res.status(500).json({ success: false, message: 'Error guardando curso' });
        }
    }
    
    // PUT - Update course
    if (req.method === 'PUT' && req.query.id) {
        const index = db.courses.findIndex(c => c.id === parseInt(req.query.id));
        
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
            return res.status(200).json({ success: true, course: db.courses[index] });
        } else {
            return res.status(500).json({ success: false, message: 'Error actualizando curso' });
        }
    }
    
    // DELETE course
    if (req.method === 'DELETE' && req.query.id) {
        const index = db.courses.findIndex(c => c.id === parseInt(req.query.id));
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Curso no encontrado' });
        }
        
        const deleted = db.courses.splice(index, 1);
        
        if (writeDB(db)) {
            return res.status(200).json({ success: true, message: 'Curso eliminado', course: deleted[0] });
        } else {
            return res.status(500).json({ success: false, message: 'Error eliminando curso' });
        }
    }
    
    return res.status(405).json({ success: false, message: 'Método no permitido' });
};
