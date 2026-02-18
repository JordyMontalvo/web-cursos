const mongoose = require('mongoose');
const Course = require('./models/Course');

const REMOTE_URI = 'mongodb://admin:ADMIN_sifrah@ec2-18-220-240-71.us-east-2.compute.amazonaws.com:27017/cursos_db?authSource=admin';

async function checkDatabase() {
    try {
        console.log('📡 Conectando a Base de Datos Remota...');
        await mongoose.connect(REMOTE_URI);
        console.log('✅ Conexión exitosa.');

        const count = await Course.countDocuments();
        console.log(`📊 Total de cursos en la base de datos: ${count}`);

        const courses = await Course.find({}, 'name category totalChapters totalEpisodes _id').sort({ createdAt: -1 }).limit(5);
        
        console.log('\n📝 Últimos 5 cursos encontrados:');
        if (courses.length === 0) {
            console.log('   (Ninguno)');
        } else {
            courses.forEach(c => {
                console.log(`   - [${c._id}] ${c.name} (${c.category}) | Caps: ${c.totalChapters}, Eps: ${c.totalEpisodes}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado.');
    }
}

checkDatabase();
