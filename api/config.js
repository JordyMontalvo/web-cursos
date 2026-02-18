// Endpoint serverless que expone la URL del backend al frontend
// Vercel lee BACKEND_URL desde Environment Variables
module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
        apiUrl: process.env.BACKEND_URL || ''
    });
};
