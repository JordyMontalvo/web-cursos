// Completa las relaciones del Punto 10 en datos existentes:
//   1. User.teamDirectorId (equipo) según quién invitó a cada cuenta.
//   2. Payment.salesOwnerId / salesOwnerRole / teamDirectorId en pagos sin vincular,
//      usando el responsable comercial actual del cliente (referredBy).
//
// Por defecto solo simula (no escribe). Para aplicar:
//   MONGODB_URI=... node scripts/backfill-sales-relations.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { teamDirectorOf, purchaseAttribution } = require('../lib/salesAccounts');

const APPLY = process.argv.includes('--apply');

async function backfillTeams() {
    // Directores y vendedores primero: el equipo de un cliente de vendedor depende del equipo del vendedor
    // `assigned` guarda lo calculado en pasadas anteriores para que la simulación cuente igual que --apply
    const assigned = new Map();
    let updated = 0;
    for (const roles of [['director'], ['vendedor'], ['user']]) {
        const accounts = await User.find({ role: { $in: roles }, referredBy: { $ne: null }, teamDirectorId: null })
            .select('_id referredBy').lean();
        const inviters = await User.find({ _id: { $in: accounts.map(a => a.referredBy) } })
            .select('_id role teamDirectorId').lean();
        const byId = new Map(inviters.map(i => [String(i._id), i]));

        const ops = [];
        accounts.forEach(a => {
            const inviter = byId.get(String(a.referredBy));
            if (inviter && !inviter.teamDirectorId && assigned.has(String(inviter._id))) {
                inviter.teamDirectorId = assigned.get(String(inviter._id));
            }
            const team = teamDirectorOf(inviter);
            if (team) {
                assigned.set(String(a._id), team);
                ops.push({ updateOne: { filter: { _id: a._id }, update: { $set: { teamDirectorId: team } } } });
            }
        });
        console.log(`Equipo (${roles[0]}): ${ops.length} de ${accounts.length} cuentas con director asignable`);
        if (APPLY && ops.length) await User.bulkWrite(ops);
        updated += ops.length;
    }
    return updated;
}

async function backfillPayments() {
    const payments = await Payment.find({ salesOwnerId: null }).select('_id userId').lean();
    const clients = await User.find({ _id: { $in: payments.map(p => p.userId) } }).select('_id referredBy').lean();
    const clientById = new Map(clients.map(c => [String(c._id), c]));

    const ops = [];
    for (const p of payments) {
        const attribution = await purchaseAttribution(User, clientById.get(String(p.userId)));
        if (attribution.salesOwnerId) ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: attribution } } });
    }
    console.log(`Pagos: ${ops.length} de ${payments.length} sin vincular tienen responsable comercial`);
    if (APPLY && ops.length) await Payment.bulkWrite(ops);
    return ops.length;
}

(async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI no está configurado');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(APPLY ? 'Modo APLICAR: se escribirán cambios.' : 'Modo SIMULACIÓN: no se escribe nada (usa --apply).');
    await backfillTeams();
    await backfillPayments();
    await mongoose.disconnect();
})().catch(err => {
    console.error(err);
    process.exit(1);
});
