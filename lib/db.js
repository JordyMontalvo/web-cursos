const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI no está configurado en variables de entorno');
    }
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
}

module.exports = { connectDB };
