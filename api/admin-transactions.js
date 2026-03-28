const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';

// Models
let User;
if (mongoose.models.User) {
    User = mongoose.model('User');
} else {
    const schema = new mongoose.Schema({
        name: String, lastName: String, email: String, role: String,
        sellerBalance: { type: Number, default: 0 },
        sellerCommission: { type: Number, default: 10 }
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

function verifyAdmin(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try {
        const d = jwt.verify(token, JWT_SECRET);
        return d.role === 'admin' ? d : null;
    } catch { return null; }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const admin = verifyAdmin(req);
    if (!admin) return res.status(403).json({ success: false, message: 'Admin access required' });

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const url = req.url.split('?')[0];

    try {
        // GET /api/admin-transactions: Todas las transacciones
        if (req.method === 'GET' && !url.includes('/withdrawals')) {
            const transactions = await Transaction.find()
                .populate('userId', 'name lastName email')
                .sort({ createdAt: -1 });
            return res.json({ success: true, transactions });
        }

        // GET /api/admin-transactions/withdrawals: Solo solicitudes de retiro
        if (req.method === 'GET' && url.endsWith('/withdrawals')) {
            const withdrawals = await Transaction.find({ type: 'withdrawal' })
                .populate('userId', 'name lastName email sellerBalance')
                .sort({ createdAt: -1 });
            return res.json({ success: true, withdrawals });
        }

        // PUT /api/admin-transactions/withdrawals: Aprobar o Rechazar retiro
        if (req.method === 'PUT' && url.endsWith('/withdrawals')) {
            const { transactionId, status } = req.body;
            if (!transactionId || !['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid data' });
            }

            const transaction = await Transaction.findById(transactionId);
            if (!transaction || transaction.type !== 'withdrawal') {
                return res.status(404).json({ success: false, message: 'Withdrawal not found' });
            }

            if (transaction.status !== 'pending') {
                return res.status(400).json({ success: false, message: 'Transaction already processed' });
            }

            const seller = await User.findById(transaction.userId);
            if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

            if (status === 'approved') {
                if (seller.sellerBalance < transaction.amount) {
                    return res.status(400).json({ success: false, message: 'Insufficient seller balance' });
                }
                // Descontar saldo
                seller.sellerBalance -= transaction.amount;
                await seller.save();
                transaction.status = 'approved';
            } else {
                transaction.status = 'rejected';
            }

            await transaction.save();
            return res.json({ success: true, message: `Withdrawal ${status}` });
        }

        return res.status(404).json({ success: false, message: 'Not found' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
};
