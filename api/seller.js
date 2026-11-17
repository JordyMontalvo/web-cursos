const { connectDB } = require('../lib/db');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

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

// Payment Model
let Payment;
try {
    Payment = mongoose.model('Payment');
} catch {
    const schema = new mongoose.Schema({
        orderId: { type: String, default: '' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        kind: { type: String, enum: ['checkout', 'renewal'], default: 'checkout' },
        status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'pending' },
        amountCents: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' },
        raw: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now }
    });
    Payment = mongoose.model('Payment', schema);
}

function verifySeller(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try {
        const d = jwt.verify(token, JWT_SECRET);
        return (d.role === 'vendedor' || d.role === 'admin') ? d : null;
    } catch {
        return null;
    }
}

function getPlanKey(planStr) {
    if (!planStr) return 'otro';
    const s = planStr.toString().toLowerCase();
    if (s.includes('trianual') || s.includes('trienal')) return 'trianual';
    if (s.includes('anual')) return 'anual';
    if (s.includes('mensual')) return 'mensual';
    return 'otro';
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

        // GET /api/seller/stats
        if (req.method === 'GET' && pathname.endsWith('/stats')) {
            const referralsCount = await User.countDocuments({ referredBy: seller._id });
            const buyersCount = await User.countDocuments({
                referredBy: seller._id,
                activeMembership: { $ne: null }
            });

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
            const referrals = await User.find({ referredBy: seller._id })
                .select('name lastName email phone country address documentType documentNumber createdAt membershipPlan membershipExpiresAt activeMembership izipayLastOrderId')
                .sort({ createdAt: -1 });

            // Fetch memberships for price reference
            const allMemberships = await Membership.find().lean();
            const priceMap = {};
            allMemberships.forEach(m => {
                if (m.planType) priceMap[m.planType.toLowerCase()] = m.price;
                if (m.name) priceMap[m.name.toLowerCase()] = m.price;
            });

            const refIds = referrals.map(u => u._id);
            const userPayments = await Payment.find({ userId: { $in: refIds }, status: 'paid' }).sort({ createdAt: -1 }).lean();
            const userComms = await Transaction.find({ userId: seller._id, sourceUserId: { $in: refIds } }).sort({ createdAt: -1 }).lean();

            const results = referrals.map(u => {
                const isMember = !!(u.activeMembership && u.membershipExpiresAt && new Date() < u.membershipExpiresAt);
                
                // Collect purchases
                const clientPayments = userPayments.filter(p => String(p.userId) === String(u._id));
                const clientComms = userComms.filter(c => String(c.sourceUserId) === String(u._id));

                let purchases = [];
                if (clientPayments.length > 0) {
                    purchases = clientPayments.map(p => ({
                        orderId: p.orderId || ('ORD-' + String(p._id).slice(-6).toUpperCase()),
                        plan: u.membershipPlan || 'Membresía',
                        amount: p.amountCents ? p.amountCents / 100 : (priceMap[getPlanKey(u.membershipPlan)] || 0),
                        currency: p.currency || 'USD',
                        date: p.createdAt,
                        status: 'Confirmada'
                    }));
                } else if (clientComms.length > 0) {
                    purchases = clientComms.map(c => ({
                        orderId: c.orderId || ('ORD-' + String(c._id).slice(-6).toUpperCase()),
                        plan: u.membershipPlan || 'Membresía',
                        amount: priceMap[getPlanKey(u.membershipPlan)] || 0,
                        currency: 'USD',
                        date: c.createdAt,
                        status: 'Confirmada'
                    }));
                } else if (u.activeMembership || u.membershipPlan) {
                    // Direct membership without payment record
                    const planKey = getPlanKey(u.membershipPlan);
                    purchases = [{
                        orderId: u.izipayLastOrderId || ('ORD-' + String(u._id).slice(-6).toUpperCase()),
                        plan: u.membershipPlan || 'Membresía',
                        amount: priceMap[planKey] || (planKey === 'mensual' ? 29 : planKey === 'anual' ? 199 : planKey === 'trianual' ? 399 : 0),
                        currency: 'USD',
                        date: u.createdAt,
                        status: isMember ? 'Confirmada' : 'Expirada'
                    }];
                }

                return {
                    ...u.toObject(),
                    hasMembership: isMember,
                    purchases
                };
            });

            return res.json({ success: true, referrals: results });
        }

        // GET /api/seller/monthly-summary
        if (req.method === 'GET' && pathname.endsWith('/monthly-summary')) {
            const now = new Date();
            const year = parseInt(parsedUrl.searchParams.get('year') || now.getFullYear(), 10);
            const month = parseInt(parsedUrl.searchParams.get('month') || (now.getMonth() + 1), 10);

            const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

            const allMemberships = await Membership.find().lean();
            const priceMap = { mensual: 29, anual: 199, trianual: 399 };
            allMemberships.forEach(m => {
                if (m.planType) priceMap[m.planType.toLowerCase()] = m.price;
            });

            // Reffered users
            const referrals = await User.find({ referredBy: seller._id }).lean();
            const refIds = referrals.map(u => u._id);
            const refMap = {};
            referrals.forEach(u => { refMap[String(u._id)] = u; });

            // 1. Payments in date range
            const payments = await Payment.find({
                userId: { $in: refIds },
                status: 'paid',
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }).sort({ createdAt: -1 }).lean();

            // 2. Transactions for seller in date range
            const commissions = await Transaction.find({
                userId: seller._id,
                type: 'commission',
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }).sort({ createdAt: -1 }).lean();

            // Compile sales
            const sales = [];
            const buyerIdSet = new Set();
            const processedOrders = new Set();

            payments.forEach(p => {
                const u = refMap[String(p.userId)] || {};
                const planKey = getPlanKey(u.membershipPlan || 'mensual');
                const amount = p.amountCents ? p.amountCents / 100 : (priceMap[planKey] || 0);
                buyerIdSet.add(String(p.userId));
                if (p.orderId) processedOrders.add(p.orderId);

                sales.push({
                    id: String(p._id),
                    orderId: p.orderId || ('ORD-' + String(p._id).slice(-6).toUpperCase()),
                    clientId: String(u._id || ''),
                    clientName: `${u.name || 'Cliente'} ${u.lastName || ''}`.trim(),
                    clientEmail: u.email || '',
                    plan: u.membershipPlan || (planKey.charAt(0).toUpperCase() + planKey.slice(1)),
                    planKey,
                    date: p.createdAt,
                    amount,
                    currency: p.currency || 'USD',
                    status: 'Confirmada'
                });
            });

            commissions.forEach(c => {
                if (c.orderId && processedOrders.has(c.orderId)) return;
                const u = refMap[String(c.sourceUserId)] || {};
                const planKey = getPlanKey(u.membershipPlan || 'mensual');
                const amount = priceMap[planKey] || 0;
                if (c.sourceUserId) buyerIdSet.add(String(c.sourceUserId));

                sales.push({
                    id: String(c._id),
                    orderId: c.orderId || ('ORD-' + String(c._id).slice(-6).toUpperCase()),
                    clientId: String(u._id || ''),
                    clientName: `${u.name || 'Cliente'} ${u.lastName || ''}`.trim(),
                    clientEmail: u.email || '',
                    plan: u.membershipPlan || (planKey.charAt(0).toUpperCase() + planKey.slice(1)),
                    planKey,
                    date: c.createdAt,
                    amount,
                    currency: 'USD',
                    status: 'Confirmada'
                });
            });

            // Also check users created in this month who have active membership and no duplicate sale
            referrals.forEach(u => {
                const uCreated = new Date(u.createdAt);
                if (uCreated >= startOfMonth && uCreated <= endOfMonth && (u.activeMembership || u.membershipPlan)) {
                    const alreadyRecorded = sales.some(s => s.clientId === String(u._id));
                    if (!alreadyRecorded) {
                        const planKey = getPlanKey(u.membershipPlan);
                        const amount = priceMap[planKey] || 0;
                        buyerIdSet.add(String(u._id));
                        sales.push({
                            id: String(u._id),
                            orderId: u.izipayLastOrderId || ('ORD-' + String(u._id).slice(-6).toUpperCase()),
                            clientId: String(u._id),
                            clientName: `${u.name || 'Cliente'} ${u.lastName || ''}`.trim(),
                            clientEmail: u.email || '',
                            plan: u.membershipPlan || (planKey.charAt(0).toUpperCase() + planKey.slice(1)),
                            planKey,
                            date: u.createdAt,
                            amount,
                            currency: 'USD',
                            status: 'Confirmada'
                        });
                    }
                }
            });

            // Calculate totals
            const totalSalesCount = sales.length;
            const uniqueBuyers = buyerIdSet.size;
            let totalAmount = 0;

            const byPlan = {
                mensual: { count: 0, amount: 0, label: 'Plan Mensual' },
                anual: { count: 0, amount: 0, label: 'Plan Anual' },
                trianual: { count: 0, amount: 0, label: 'Plan Trianual' }
            };

            sales.forEach(s => {
                totalAmount += s.amount;
                const k = byPlan[s.planKey] ? s.planKey : 'mensual';
                byPlan[k].count += 1;
                byPlan[k].amount += s.amount;
            });

            return res.json({
                success: true,
                year,
                month,
                summary: {
                    uniqueBuyers,
                    totalSalesCount,
                    totalAmount,
                    byPlan,
                    sales
                }
            });
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
