const multer = require('multer');
const path = require('path');

// Configurar multer para Vercel (usar /tmp)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/tmp');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Middleware para procesar multipart/form-data
const uploadMiddleware = upload.single('image');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }
    
    // Procesar upload
    uploadMiddleware(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
        }
        
        // En Vercel, los archivos en /tmp no persisten
        // Por ahora retornamos la URL por defecto
        const imageUrl = '/uploads/default-course.jpg';
        
        return res.status(200).json({ 
            success: true, 
            imageUrl,
            message: 'Nota: En Vercel, usa un servicio externo como Cloudinary o AWS S3 para almacenar imágenes'
        });
    });
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
