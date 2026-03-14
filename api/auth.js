const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const mailUser = process.env.EMAIL_USER || 'soporteiatibetepisodios@gmail.com';
const mailPassword = process.env.EMAIL_PASS || 'dkgdrsqmmknezahz';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: mailUser,
        pass: mailPassword
    }
});

async function sendWelcomeEmail(email, name, password, provider = 'local') {
    try {
        console.log(`[BACKEND] Iniciando envío de correo de bienvenida a: ${email} (Provider: ${provider})`);
        
        const passText = provider === 'google' 
            ? '<em>Iniciaste sesión vinculando tu cuenta de Google. No necesitas contraseña.</em>' 
            : password;

        const mailOptions = {
            from: `"IATIBET" <${mailUser}>`,
            to: email,
            subject: '¡Bienvenido a IATIBET!',
            html: `
                <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; background-color: #f9f9fa; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #6a1b9a;">¡Bienvenido a IATIBET!</h1>
                    </div>
                    <p style="font-size: 16px;">Hola <strong>${name}</strong>,</p>
                    <p style="font-size: 16px;">¡Tu registro ha sido exitoso! Estamos muy emocionados de tenerte con nosotros. A continuación, te compartimos tu información de acceso:</p>
                    <div style="background-color: #fff; padding: 15px; border-radius: 5px; border-left: 4px solid #6a1b9a; margin: 20px 0;">
                        <p style="margin: 0; font-size: 16px;"><strong>Usuario / Correo:</strong> ${email}</p>
                        <p style="margin: 5px 0 0 0; font-size: 16px;"><strong>Contraseña:</strong> ${passText}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">Te recomendamos guardar esta información en un lugar seguro. Puedes personalizar la información en tu perfil una vez adentrado a la plataforma.</p>
                    <p style="font-size: 16px; margin-top: 30px;">Atentamente,<br><strong>El equipo de IATIBET</strong></p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`[BACKEND] ✅ Correo de bienvenida enviado con éxito a ${email}. Info ID: ${info.messageId}`);
    } catch (error) {
        console.error(`[BACKEND] ❌ Error crítico enviando correo de bienvenida a ${email}:`, error);
    }
}

async function sendPasswordResetEmail(email, name, resetUrl) {
    try {
        console.log(`[BACKEND] Iniciando envío de correo de recuperación a: ${email}`);
        
        const mailOptions = {
            from: `"IATIBET" <${mailUser}>`,
            to: email,
            subject: 'Recuperación de Contraseña - IATIBET',
            html: `
                <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; background-color: #f9f9fa; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #6a1b9a;">Restablece tu Contraseña</h1>
                    </div>
                    <p style="font-size: 16px;">Hola <strong>${name}</strong>,</p>
                    <p style="font-size: 16px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta asociada a este correo electrónico.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #6a1b9a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Restablecer Contraseña</a>
                    </div>
                    <p style="font-size: 14px; color: #666;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                    <p style="font-size: 14px; color: #0056b3; word-break: break-all;"><a href="${resetUrl}" style="color: #6a1b9a;">${resetUrl}</a></p>
                    <p style="font-size: 14px; color: #666;">Este enlace expirará en 1 hora. Si no solicitaste un cambio de contraseña, simplemente ignora este correo y tu cuenta seguirá segura.</p>
                    <p style="font-size: 16px; margin-top: 30px;">Atentamente,<br><strong>El equipo de IATIBET</strong></p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`[BACKEND] ✅ Correo de recuperación enviado con éxito a ${email}. Info ID: ${info.messageId}`);
    } catch (error) {
        console.error(`[BACKEND] ❌ Error crítico enviando correo de recuperación a ${email}:`, error);
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';
const GOOGLE_CLIENT_ID    = process.env.GOOGLE_CLIENT_ID    || '';
const GITHUB_CLIENT_ID    = process.env.GITHUB_CLIENT_ID    || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const APP_URL             = process.env.APP_URL             || 'http://localhost:3000';

// ── User model (inline para Vercel serverless) ──────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name:        { type: String, required: true, trim: true },
        lastName:    { type: String, trim: true },
        email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone:       { type: String, trim: true },
        country:     { type: String, trim: true },
        city:        { type: String, trim: true },
        birthDate:   { type: String, trim: true },
        password:    { type: String, required: false }, // opcional para usuarios OAuth
        // OAuth fields
        googleId:    { type: String, sparse: true },
        githubId:    { type: String, sparse: true },
        avatar:      { type: String, default: null },
        provider:    { type: String, enum: ['local', 'google', 'github'], default: 'local' },
        role:        { type: String, enum: ['user', 'admin'], default: 'user' },
        activeMembership:    { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan:      { type: String, default: null },
        resetPasswordToken:  { type: String },
        resetPasswordExpires:{ type: Date },
        createdAt:   { type: Date, default: Date.now },
        updatedAt:   { type: Date, default: Date.now }
    });
    schema.pre('save', async function () {
        if (this.password && this.isModified('password')) {
            this.password = await bcrypt.hash(this.password, 12);
        }
        this.updatedAt = Date.now();
    });
    schema.methods.comparePassword = async function (p) {
        if (!this.password) return false;
        return bcrypt.compare(p, this.password);
    };
    schema.methods.hasMembership = function () {
        if (!this.activeMembership || !this.membershipExpiresAt) return false;
        return new Date() < this.membershipExpiresAt;
    };
    User = mongoose.model('User', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function generateToken(user) {
    return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function formatUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
        provider: user.provider || 'local',
        hasMembership: user.hasMembership ? user.hasMembership() : false,
        membershipPlan: user.membershipPlan
    };
}

// ── OAuth helpers ──────────────────────────────────────────────────
function fetchHttps(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: opts.method || 'GET',
            headers: opts.headers || {}
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
        req.on('error', reject);
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

async function verifyGoogleToken(idToken) {
    const data = await fetchHttps(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (data.error) throw new Error('Token de Google inválido: ' + (data.error_description || data.error));
    if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID)
        throw new Error('Token no pertenece a esta aplicación');
    return { googleId: data.sub, email: data.email, name: data.name, avatar: data.picture };
}

async function getGithubToken(code) {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
    });
    const data = await fetchHttps('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: params.toString()
    });
    if (data.error) throw new Error('Error GitHub token: ' + data.error_description);
    return data.access_token;
}

async function getGithubUser(token) {
    const [user, emails] = await Promise.all([
        fetchHttps('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'iatibet-app', Accept: 'application/vnd.github.v3+json' } }),
        fetchHttps('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'iatibet-app', Accept: 'application/vnd.github.v3+json' } })
    ]);
    const email = (Array.isArray(emails) ? emails.find(e => e.primary && e.verified)?.email : null) || user.email;
    if (!email) throw new Error('No se pudo obtener el email de GitHub. Asegúrate de tener un email público o verificado.');
    return { githubId: String(user.id), email, name: user.name || user.login, avatar: user.avatar_url };
}

module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error', error: err.message });
    }

    const url = req.url.split('?')[0];

    // ── POST /api/auth/register ──────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/register')) {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });
        const user = new User({ name, email, password });
        await user.save();
        
        // Enviar correo de bienvenida esperando su resolución (necesario en Serverless)
        await sendWelcomeEmail(email, name, password).catch(console.error);

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true, token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, hasMembership: false }
        });
    }

    // ── POST /api/auth/login ─────────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/login')) {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        const hasMem = user.hasMembership();
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true, token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, hasMembership: hasMem, membershipPlan: user.membershipPlan }
        });
    }

    // ── POST /api/auth/forgot-password ───────────────────────────
    if (req.method === 'POST' && url.endsWith('/forgot-password')) {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'El correo es requerido' });

        const user = await User.findOne({ email });
        // Por seguridad, retornamos éxito incluso si no existe el correo
        if (!user) return res.json({ success: true, message: 'Si el correo existe, se ha enviado un enlace de recuperación.' });

        if (user.provider && user.provider !== 'local') {
            return res.status(400).json({ success: false, message: 'Esta cuenta utiliza un proveedor externo (Google/GitHub) para iniciar sesión.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
        await user.save();

        const resetUrl = `${APP_URL}/reset-password.html?token=${resetToken}`;
        await sendPasswordResetEmail(user.email, user.name, resetUrl);

        return res.json({ success: true, message: 'Si el correo existe, se ha enviado un enlace de recuperación.' });
    }

    // ── POST /api/auth/reset-password ────────────────────────────
    if (req.method === 'POST' && url.endsWith('/reset-password')) {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token y nueva contraseña son requeridos' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ success: false, message: 'El enlace de recuperación es inválido o ha expirado.' });

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });
    }

    // ── GET /api/auth/me ─────────────────────────────────────────
    if (req.method === 'GET' && url.endsWith('/me')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Token inválido' });
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return res.json({ success: true, user: { ...user.toObject(), hasMembership: user.hasMembership() } });
    }

    // ── PUT /api/auth/me ─────────────────────────────────────────
    if (req.method === 'PUT' && url.endsWith('/me')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'Token inválido' });
        
        try {
            const user = await User.findById(decoded.id);
            if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

            const { name, lastName, phone, country, city, birthDate, currentPassword, newPassword } = req.body;
            
            if (name) user.name = name;
            if (lastName !== undefined) user.lastName = lastName;
            if (phone !== undefined) user.phone = phone;
            if (country !== undefined) user.country = country;
            if (city !== undefined) user.city = city;
            if (birthDate !== undefined) user.birthDate = birthDate;

            // Password change
            if (currentPassword && newPassword) {
                const ok = await user.comparePassword(currentPassword);
                if (!ok) {
                    return res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta' });
                }
                user.password = newPassword; // it will be hashed by pre-save
            }

            await user.save();
            const updatedUser = user.toObject();
            delete updatedUser.password;
            
            return res.json({ success: true, message: 'Perfil actualizado exitosamente', user: { ...updatedUser, hasMembership: user.hasMembership() } });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error al actualizar perfil', error: error.message });
        }
    }

    // ── GET /api/auth/check-access ───────────────────────────────
    if (req.method === 'GET' && url.endsWith('/check-access')) {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ success: false, message: 'No autenticado' });
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        const hasMem = user.hasMembership();
        const hasAccess = hasMem || user.role === 'admin';
        return res.json({ success: true, hasAccess, hasMembership: hasMem, membershipPlan: user.membershipPlan, role: user.role });
    }

    // ── POST /api/auth/google ─────────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/google')) {
        const { token: idToken } = req.body;
        if (!idToken) return res.status(400).json({ success: false, message: 'Token de Google requerido' });
        let gData;
        try { gData = await verifyGoogleToken(idToken); }
        catch (err) { return res.status(401).json({ success: false, message: err.message }); }
        try {
            let user = await User.findOne({ googleId: gData.googleId }) || await User.findOne({ email: gData.email });
            if (user) {
                if (!user.googleId) { user.googleId = gData.googleId; user.provider = 'google'; if (!user.avatar) user.avatar = gData.avatar; await user.save(); }
            } else {
                user = new User({ name: gData.name, email: gData.email, googleId: gData.googleId, avatar: gData.avatar, provider: 'google' });
                await user.save();
                
                // Enviar correo de bienvenida al registrarse la primera vez con Google
                await sendWelcomeEmail(gData.email, gData.name, null, 'google').catch(console.error);
            }
            return res.json({ success: true, token: generateToken(user), user: formatUser(user) });
        } catch (err) {
            return res.status(500).json({ success: false, message: 'Error al procesar login con Google', error: err.message });
        }
    }

    // ── GET /api/auth/github ── inicia el flujo OAuth redirect ───
    if (req.method === 'GET' && url.endsWith('/github')) {
        if (!GITHUB_CLIENT_ID) return res.status(500).json({ success: false, message: 'GitHub OAuth no configurado (falta GITHUB_CLIENT_ID)' });
        const redirect = `${APP_URL}/api/auth/github/callback`;
        return res.redirect(302, `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}&scope=user:email`);
    }

    // ── GET /api/auth/github/callback ────────────────────────────
    if (req.method === 'GET' && url.includes('/github/callback')) {
        const qs = new URLSearchParams(req.url.split('?')[1] || '');
        const code = qs.get('code');
        const error = qs.get('error');
        if (error || !code) return res.redirect(302, `/login?error=${error || 'no_code'}`);
        try {
            const accessToken = await getGithubToken(code);
            const ghData = await getGithubUser(accessToken);
            let user = await User.findOne({ githubId: ghData.githubId }) || await User.findOne({ email: ghData.email });
            if (user) {
                if (!user.githubId) { user.githubId = ghData.githubId; user.provider = 'github'; if (!user.avatar) user.avatar = ghData.avatar; await user.save(); }
            } else {
                user = new User({ name: ghData.name, email: ghData.email, githubId: ghData.githubId, avatar: ghData.avatar, provider: 'github' });
                await user.save();
            }
            const jwtToken = generateToken(user);
            const userEncoded = encodeURIComponent(JSON.stringify(formatUser(user)));
            return res.redirect(302, `/login?oauth_token=${jwtToken}&oauth_user=${userEncoded}`);
        } catch (err) {
            return res.redirect(302, `/login?error=${encodeURIComponent(err.message)}`);
        }
    }

    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};
