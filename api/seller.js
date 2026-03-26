const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// Redifinir User Model
let User;
if (mongoose.models.User) {
    User = mongoose.model('User');
} else {
    const schema = new mongoose.Schema({
        name: String,
        lastName: String,
        email: String,
        phone: String,
        country: String,
        role: String,
        sellerCode: String,
        sellerBalance: { type: Number, default: 0 },
        sellerCommission: { type: Number, default: 10 },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
        membershipExpiresAt: Date,
        membershipPlan: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    User = mongoose.model('User', schema);
}

function verifySeller(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try {
        const d = jwt.verify(token, JWT_SECRET);
        return (d.role === 'vendedor' || d.role === 'admin') ? d : null;
    } catch { return null; }
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifySeller(req);
    if (!user) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const url = req.url.split('?')[0];

    try {
        // GET /api/seller/stats
        if (url.endsWith('/stats')) {
            const seller = await User.findById(user.id);
            if (!seller) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });

            const count = await User.countDocuments({ referredBy: seller._id });
            
            return res.json({
                success: true,
                stats: {
                    balance: seller.sellerBalance || 0,
                    referralsCount: count,
                    code: seller.sellerCode,
                    commission: seller.sellerCommission || 10
                }
            });
        }

        // GET /api/seller/referrals
        if (url.endsWith('/referrals')) {
            const referrals = await User.find({ referredBy: user.id })
                .select('name lastName email phone country createdAt membershipPlan membershipExpiresAt activeMembership')
                .sort({ createdAt: -1 });
            
            const results = referrals.map(u => ({
                ...u.toObject(),
                hasMembership: !!(u.activeMembership && u.membershipExpiresAt && new Date() < u.membershipExpiresAt)
            }));

            return res.json({ success: true, referrals: results });
        }

        return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
};
