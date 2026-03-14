// Endpoint serverless que expone la URL del backend al frontend
// Vercel lee BACKEND_URL desde Environment Variables
module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
        apiUrl: process.env.BACKEND_URL || '',
        izipayPublicKey: process.env.IZIPAY_PUBLIC_KEY || '',
        izipayShopId: process.env.IZIPAY_SHOP_ID || ''
    });
};
