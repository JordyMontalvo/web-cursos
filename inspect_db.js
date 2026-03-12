const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const REMOTA_URI = 'mongodb://admin:ADMIN_sifrah@ec2-18-220-240-71.us-east-2.compute.amazonaws.com:27017/cursos_db?authSource=admin';

async function checkDb() {
    try {
        await mongoose.connect(REMOTA_URI);
        const settings = await Settings.find();
        console.log('Settings count:', settings.length);
        settings.forEach((s, i) => {
            console.log(`Setting ${i}:`, {
                id: s._id,
                companyName: s.companyName,
                logoUrlSnippet: s.logoUrl ? s.logoUrl.substring(0, 50) + '...' : 'empty',
                presentationVideoUrl: s.presentationVideoUrl
            });
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
