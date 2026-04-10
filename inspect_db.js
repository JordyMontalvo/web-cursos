const mongoose = require('mongoose');

const REMOTA_URI = "mongodb+srv://iatibet:iatibet2025@atibet.u0vvt.mongodb.net/iatibet?retryWrites=true&w=majority&appName=atibet";

// Definir esquemas para evitar requerir server.js
const userSchema = new mongoose.Schema({
    email: String,
    role: String,
    name: String
}, { collection: 'users' });

const settingsSchema = new mongoose.Schema({
    companyName: String,
    logoUrl: String,
    presentationVideoUrl: String,
    presentationVideoTitle: String
}, { collection: 'settings' });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

async function inspect() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(REMOTA_URI);
        console.log('Connected.');

        // List users
        console.log('\n--- Users ---');
        const users = await User.find().select('email role name');
        console.log('Users count:', users.length);
        users.forEach(u => {
            console.log(`${u.email} [${u.role}] - ${u.name}`);
        });

        // List settings
        console.log('\n--- Settings ---');
        const sData = await Settings.findOne();
        console.log(sData);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

inspect();
