const { connectDB } = require('../lib/db');
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

let Transaction;
try { Transaction = mongoose.model('Transaction'); } catch {
    const schema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['commission', 'withdrawal'], default: 'commission' },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'completed', 'approved', 'rejected'], default: 'completed' },
        description: String,
        createdAt: { type: Date, default: Date.now }
    });
    Transaction = mongoose.model('Transaction', schema);
}

let Settings;
try { Settings = mongoose.model('Settings'); } catch {
    const schema = new mongoose.Schema({
        sellerCommissionGlobal: { type: Number, default: 10 },
        updatedAt: { type: Date, default: Date.now }
    });
    Settings = mongoose.model('Settings', schema);
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
            const settings = await Settings.findOne();
            const globalCommission = Number(settings?.sellerCommissionGlobal);

            const count = await User.countDocuments({ referredBy: seller._id });
            
            return res.json({
                success: true,
                stats: {
                    balance: seller.sellerBalance || 0,
                    referralsCount: count,
                    code: seller.sellerCode,
                    commission: Number.isFinite(globalCommission) ? globalCommission : 10
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

        // GET /api/seller/transactions
        if (req.method === 'GET' && url.endsWith('/transactions')) {
            const transactions = await Transaction.find({ userId: user.id })
                .sort({ createdAt: -1 });
            return res.json({ success: true, transactions });
        }

        // POST /api/seller/withdraw
        if (req.method === 'POST' && url.endsWith('/withdraw')) {
            const { amount } = req.body;
            if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });

            const seller = await User.findById(user.id);
            if (!seller) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });

            if ((seller.sellerBalance || 0) < amount) {
                return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
            }

            // Crear solicitud de retiro
            await Transaction.create({
                userId: seller._id,
                type: 'withdrawal',
                amount: amount,
                status: 'pending',
                description: `Solicitud de retiro de saldo`
            });

            // Opcional: Descontar el saldo inmediatamente o esperar a aprobación.
            // Para ser seguros, lo descontamos al aprobar.
            
            return res.json({ success: true, message: 'Solicitud de retiro enviada correctamente' });
        }

        return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
};
