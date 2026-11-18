const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const {
    getDirectorTeam,
    getDirectorDirectors,
    getSellerClients,
    getTeamMonthlySales,
    hasPermission,
    getOwnClients,
    getPersonalMonthlySales,
    getAccountSales
} = require('../lib/salesAccounts');

const JWT_SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET env var not set'); })();

// User Model
let User;
try {
    User = mongoose.model('User');
} catch {
    User = require('../models/User');
}

// Membership Model
let Membership;
try {
    Membership = mongoose.model('Membership');
} catch {
    Membership = require('../models/Membership');
}

// Transaction Model
let Transaction;
try {
    Transaction = mongoose.model('Transaction');
} catch {
    const schema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['commission', 'withdrawal'], default: 'commission' },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'completed', 'approved', 'rejected'], default: 'completed' },
        description: String,
        orderId: { type: String, default: '' },
        sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        createdAt: { type: Date, default: Date.now }
    });
    Transaction = mongoose.model('Transaction', schema);
}

const Payment = require('../models/Payment');

function verifySeller(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try {
        const d = jwt.verify(token, JWT_SECRET);
        return hasPermission(d.role, 'sales.panel') ? d : null;
    } catch {
        return null;
    }
}


module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const sellerAuth = verifySeller(req);
    if (!sellerAuth) return res.status(403).json({ success: false, message: 'Acceso denegado' });

    try {
        await connectDB();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    try {
        const seller = await User.findById(sellerAuth.id);
        if (!seller) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });

        // GET /api/director/team y /api/director/directors (Punto 7)
        if (req.method === 'GET' && pathname.startsWith('/api/director/')) {
            if (!hasPermission(seller.role, 'team.view')) return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de director de ventas.' });
            if (pathname.endsWith('/team-summary')) {
                const now = new Date();
                const year = parseInt(parsedUrl.searchParams.get('year') || now.getFullYear(), 10);
                const month = parseInt(parsedUrl.searchParams.get('month') || (now.getMonth() + 1), 10);
                return res.json({ success: true, summary: await getTeamMonthlySales(User, Payment, Membership, seller._id, year, month) });
            }
            const teamMatch = pathname.match(/\/api\/director\/team\/([^/]+)$/);
            if (teamMatch) {
                const detail = await getSellerClients(User, Payment, Membership, seller._id, teamMatch[1]);
                if (!detail) return res.status(404).json({ success: false, message: 'El vendedor no pertenece a tu equipo.' });
                return res.json({ success: true, ...detail });
            }
            if (pathname.endsWith('/team')) return res.json({ success: true, sellers: await getDirectorTeam(User, Payment, Membership, seller._id) });
            if (pathname.endsWith('/directors')) return res.json({ success: true, directors: await getDirectorDirectors(User, seller._id) });
        }

        // GET /api/seller/stats
        if (req.method === 'GET' && pathname.endsWith('/stats')) {
            const referralsCount = await User.countDocuments({ referredBy: seller._id, role: 'user' });
            const { sales } = await getAccountSales(User, Payment, Membership, [seller._id]);
            const buyersCount = new Set(sales.map(s => s.clientId)).size;

            return res.json({
                success: true,
                stats: {
                    name: seller.name,
                    lastName: seller.lastName || '',
                    email: seller.email,
                    code: seller.sellerCode,
                    balance: seller.sellerBalance || 0,
                    commission: seller.sellerCommission || 10,
                    referralsCount,
                    buyersCount
                }
            });
        }

        // GET /api/seller/profile
        if (req.method === 'GET' && pathname.endsWith('/profile')) {
            return res.json({
                success: true,
                profile: {
                    id: seller._id,
                    name: seller.name || '',
                    lastName: seller.lastName || '',
                    email: seller.email,
                    phone: seller.phone || '',
                    country: seller.country || '',
                    address: seller.address || '',
                    documentType: seller.documentType || 'DNI',
                    documentNumber: seller.documentNumber || '',
                    sellerCode: seller.sellerCode || '',
                    createdAt: seller.createdAt
                }
            });
        }

        // PUT /api/seller/profile
        if (req.method === 'PUT' && pathname.endsWith('/profile')) {
            const { name, lastName, phone, country, address, documentType, documentNumber } = req.body || {};
            if (name) seller.name = name.trim();
            if (lastName !== undefined) seller.lastName = lastName.trim();
            if (phone !== undefined) seller.phone = phone.trim();
            if (country !== undefined) seller.country = country.trim();
            if (address !== undefined) seller.address = address.trim();
            if (documentType && ['DNI', 'Cédula', 'Pasaporte'].includes(documentType)) {
                seller.documentType = documentType;
            }
            if (documentNumber !== undefined) seller.documentNumber = documentNumber.trim();
            // sellerCode, email, role, referredBy are protected and non-editable
            await seller.save();

            return res.json({
                success: true,
                message: 'Perfil actualizado correctamente',
                profile: {
                    id: seller._id,
                    name: seller.name,
                    lastName: seller.lastName,
                    email: seller.email,
                    phone: seller.phone,
                    country: seller.country,
                    address: seller.address,
                    documentType: seller.documentType,
                    documentNumber: seller.documentNumber,
                    sellerCode: seller.sellerCode,
                    createdAt: seller.createdAt
                }
            });
        }

        // GET /api/seller/referrals
        if (req.method === 'GET' && pathname.endsWith('/referrals')) {
            const referrals = await getOwnClients(User, Payment, Membership, seller._id);
            return res.json({ success: true, referrals });
        }

        // GET /api/seller/monthly-summary
        if (req.method === 'GET' && pathname.endsWith('/monthly-summary')) {
            const year = parsedUrl.searchParams.get('year');
            const month = parsedUrl.searchParams.get('month');
            const r = await getPersonalMonthlySales(User, Payment, Membership, seller._id, year, month);
            return res.json({ success: true, ...r });
        }

        // GET /api/seller/transactions
        if (req.method === 'GET' && pathname.endsWith('/transactions')) {
            const transactions = await Transaction.find({ userId: seller._id }).sort({ createdAt: -1 });
            return res.json({ success: true, transactions });
        }

        // POST /api/seller/withdraw
        if (req.method === 'POST' && pathname.endsWith('/withdraw')) {
            const { amount } = req.body || {};
            if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });

            if ((seller.sellerBalance || 0) < amount) {
                return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
            }

            // Crear solicitud de retiro
            await Transaction.create({
                userId: seller._id,
                type: 'withdrawal',
                amount: amount,
                status: 'pending',
                description: 'Solicitud de retiro de saldo'
            });

            return res.json({
                success: true,
                message: 'Solicitud de retiro registrada. Apartado preparado para la entrega de comisiones y retiros.'
            });
        }

        return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
};
