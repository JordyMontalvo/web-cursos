const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const crypto = require('crypto');

// ── Models (inline para serverless) ──────────────────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name: String, email: String,
        activeMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
        membershipExpiresAt: Date,
        membershipPlan: String,
        updatedAt: { type: Date, default: Date.now }
    });
    User = mongoose.model('User', schema);
}

let Membership;
try { Membership = mongoose.model('Membership'); } catch {
    const schema = new mongoose.Schema({
        name: String,
        durationDays: { type: Number, default: 30 }
    });
    Membership = mongoose.model('Membership', schema);
}

function verifyHash(answer, hash, key) {
    const calculatedHash = crypto
        .createHmac('sha256', key)
        .update(answer)
        .digest('hex');
    return calculatedHash === hash;
}

module.exports = async (req, res) => {
    // Izipay envía un POST con x-www-form-urlencoded o JSON
    // Vercel lo parsea automáticamente si es JSON.
    const { "kr-answer": krAnswer, "kr-hash": krHash, "kr-hash-key": krHashKey } = req.body || {};

    if (!krAnswer || !krHash) {
        return res.status(400).send('Faltan parámetros kr-answer o kr-hash');
    }

    const hmacKey = process.env.IZIPAY_HMAC_SHA256;
    if (!hmacKey) {
        console.error('IZIPAY_HMAC_SHA256 no configurado en el servidor');
        return res.status(500).send('Error de configuración');
    }

    // Verificar autenticidad
    // Nota: krAnswer puede venir como objeto si Vercel lo parseó, 
    // pero para el hash necesitamos la cadena original.
    const answerStr = (typeof krAnswer === 'string') ? krAnswer : JSON.stringify(krAnswer);
    
    if (!verifyHash(answerStr, krHash, hmacKey)) {
        console.error('Hash de Izipay inválido');
        return res.status(401).send('Firma inválida');
    }

    const answer = JSON.parse(answerStr);
    
    // Solo procesamos pagos exitosos
    if (answer.orderStatus !== 'PAID') {
        console.log(`Pago no completado. Status: ${answer.orderStatus}`);
        return res.status(200).send('OK (Status no es PAID)');
    }

    try {
        await connectDB();

        // Extraer info. El orderId lo seteamos como USR_[id]_MEM_[id]_[ts]
        const orderId = answer.orderDetails.orderId;
        const parts = orderId.split('_');
        const userId = parts[1];
        const membershipId = parts[3];

        if (!userId || !membershipId) {
            throw new Error(`No se pudo extraer IDs del orderId: ${orderId}`);
        }

        const user = await User.findById(userId);
        const membership = await Membership.findById(membershipId);

        if (!user || !membership) {
            throw new Error('Usuario o Membresía no encontrados en DB');
        }

        // Calcular expiración
        let expiresAt;
        if (!membership.durationDays || membership.durationDays === 0) {
            expiresAt = new Date('2099-12-31');
        } else {
            expiresAt = new Date(Date.now() + membership.durationDays * 24 * 60 * 60 * 1000);
        }

        // Actualizar usuario
        user.activeMembership = membership._id;
        user.membershipExpiresAt = expiresAt;
        user.membershipPlan = membership.name;
        user.updatedAt = new Date();
        await user.save();

        console.log(`✅ Membresía "${membership.name}" activada para ${user.email} vía Webhook Izipay`);
        
        return res.status(200).json({ success: true, message: 'Membresía activada' });

    } catch (error) {
        console.error('Error en Webhook Izipay:', error.message);
        return res.status(500).send('Error procesando el webhook');
    }
};
