const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:ADMIN_sifrah@ec2-18-220-240-71.us-east-2.compute.amazonaws.com:27017/cursos_db?authSource=admin';

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
}

module.exports = { connectDB };
