const { connectDB } = require('./_db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const nodemailer = require('nodemailer');

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
        console.log(`[FRONTEND-API] Iniciando envío de correo de bienvenida a: ${email} (Provider: ${provider})`);

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
        console.log(`[FRONTEND-API] ✅ Correo OAuth enviado con éxito a ${email}. Info ID: ${info.messageId}`);
    } catch (error) {
        console.error(`[FRONTEND-API] ❌ Error enviando correo OAuth de bienvenida a ${email}:`, error);
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'iatibet_zureon_jwt_secret_2024';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ── User model (inline para Vercel serverless) ──────────────────
let User;
try { User = mongoose.model('User'); } catch {
    const schema = new mongoose.Schema({
        name:     { type: String, required: true, trim: true },
        email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: false },
        googleId: { type: String, sparse: true },
        githubId: { type: String, sparse: true },
        avatar:   { type: String, default: null },
        provider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
        role:     { type: String, enum: ['user', 'admin'], default: 'user' },
        activeMembership:    { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
        membershipExpiresAt: { type: Date, default: null },
        membershipPlan:      { type: String, default: null },
        resetPasswordToken:  { type: String },
        resetPasswordExpires:{ type: Date },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    schema.pre('save', async function () {
        if (this.password && this.isModified('password')) {
            this.password = await bcrypt.hash(this.password, 12);
        }
        this.updatedAt = Date.now();
    });
    schema.methods.hasMembership = function () {
        if (!this.activeMembership || !this.membershipExpiresAt) return false;
        return new Date() < this.membershipExpiresAt;
    };
    User = mongoose.model('User', schema);
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Generar JWT interno ──────────────────────────────────────────
function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// ── Formato de respuesta de usuario ─────────────────────────────
function formatUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        provider: user.provider,
        hasMembership: user.hasMembership ? user.hasMembership() : false,
        membershipPlan: user.membershipPlan
    };
}

// ── Verificar Google ID Token ────────────────────────────────────
function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = { ...options };
        const urlObj = new URL(url);
        reqOptions.hostname = urlObj.hostname;
        reqOptions.path = urlObj.pathname + urlObj.search;
        reqOptions.method = options.method || 'GET';

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function verifyGoogleToken(idToken) {
    // Verifica el token con la API de Google tokeninfo
    const data = await fetchJson(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    if (data.error) throw new Error('Token de Google inválido: ' + data.error_description);
    // Verificar que el token sea para nuestra app (en producción DEBE verificarse)
    if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
        throw new Error('Token no pertenece a esta aplicación');
    }
    return {
        googleId: data.sub,
        email: data.email,
        name: data.name,
        avatar: data.picture,
        emailVerified: data.email_verified === 'true'
    };
}

// ── Intercambiar código GitHub por access_token ──────────────────
async function getGithubAccessToken(code) {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
    });

    const res = await fetchJson('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: params.toString(),
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        port: 443
    });

    if (res.error) throw new Error('Error obteniendo token de GitHub: ' + res.error_description);
    return res.access_token;
}

async function getGithubUser(accessToken) {
    const [userRes, emailsRes] = await Promise.all([
        fetchJson('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'iatibet-zureon-app',
                Accept: 'application/vnd.github.v3+json'
            }
        }),
        fetchJson('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'iatibet-zureon-app',
                Accept: 'application/vnd.github.v3+json'
            }
        })
    ]);

    // Obtener email primario verificado
    const primaryEmail = Array.isArray(emailsRes)
        ? emailsRes.find(e => e.primary && e.verified)?.email
        : userRes.email;

    if (!primaryEmail) throw new Error('No se pudo obtener el email de GitHub. Asegúrate de tener un email público.');

    return {
        githubId: String(userRes.id),
        email: primaryEmail,
        name: userRes.name || userRes.login,
        avatar: userRes.avatar_url
    };
}

// ── Handler principal ────────────────────────────────────────────
module.exports = async (req, res) => {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await connectDB(); } catch (err) {
        return res.status(500).json({ success: false, message: 'DB error', error: err.message });
    }

    const url = req.url.split('?')[0];

    /*
    // ── POST /api/auth/google ──────────────────────────────────
    if (req.method === 'POST' && url.endsWith('/google')) {
        const { token: idToken } = req.body;
        if (!idToken) return res.status(400).json({ success: false, message: 'Token de Google requerido' });

        let googleData;
        try {
            googleData = await verifyGoogleToken(idToken);
        } catch (err) {
            return res.status(401).json({ success: false, message: err.message });
        }

        try {
            // Buscar usuario por googleId o email
            let user = await User.findOne({ googleId: googleData.googleId })
                || await User.findOne({ email: googleData.email });

            if (user) {
                // Actualizar datos OAuth si aún no tiene googleId
                if (!user.googleId) {
                    user.googleId = googleData.googleId;
                    user.provider = 'google';
                    if (!user.avatar) user.avatar = googleData.avatar;
                    await user.save();
                }
            } else {
                // Nuevo usuario via Google
                user = new User({
                    name: googleData.name,
                    email: googleData.email,
                    googleId: googleData.googleId,
                    avatar: googleData.avatar,
                    provider: 'google'
                });
                await user.save();
                
                // Enviar correo electrónico a la nueva cuenta guardada de google
                await sendWelcomeEmail(googleData.email, googleData.name, null, 'google').catch(console.error);
            }

            const jwtToken = generateToken(user);
            return res.json({ success: true, token: jwtToken, user: formatUser(user) });

        } catch (err) {
            return res.status(500).json({ success: false, message: 'Error procesando autenticación con Google', error: err.message });
        }
    }
    */

    // ── GET /api/auth/github ── inicia el flujo OAuth ──────────
    if (req.method === 'GET' && url.endsWith('/github')) {
        if (!GITHUB_CLIENT_ID) {
            return res.status(500).json({ success: false, message: 'GitHub OAuth no configurado. Agrega GITHUB_CLIENT_ID en variables de entorno.' });
        }
        const redirectUri = `${APP_URL}/api/auth/github/callback`;
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
        return res.redirect(302, githubAuthUrl);
    }

    // ── GET /api/auth/github/callback ───────────────────────────
    if (req.method === 'GET' && url.endsWith('/github/callback')) {
        const code = new URLSearchParams(req.url.split('?')[1] || '').get('code');
        const error = new URLSearchParams(req.url.split('?')[1] || '').get('error');

        if (error) {
            return res.redirect(302, `/login?error=github_denied`);
        }
        if (!code) {
            return res.redirect(302, `/login?error=github_no_code`);
        }

        try {
            const accessToken = await getGithubAccessToken(code);
            const githubData = await getGithubUser(accessToken);

            let user = await User.findOne({ githubId: githubData.githubId })
                || await User.findOne({ email: githubData.email });

            if (user) {
                if (!user.githubId) {
                    user.githubId = githubData.githubId;
                    user.provider = 'github';
                    if (!user.avatar) user.avatar = githubData.avatar;
                    await user.save();
                }
            } else {
                user = new User({
                    name: githubData.name,
                    email: githubData.email,
                    githubId: githubData.githubId,
                    avatar: githubData.avatar,
                    provider: 'github'
                });
                await user.save();
            }

            const jwtToken = generateToken(user);

            // Redirigir con el token como parámetro para que el frontend lo guarde
            const userEncoded = encodeURIComponent(JSON.stringify(formatUser(user)));
            return res.redirect(302, `/login?oauth_token=${jwtToken}&oauth_user=${userEncoded}`);

        } catch (err) {
            console.error('GitHub OAuth error:', err);
            return res.redirect(302, `/login?error=${encodeURIComponent(err.message)}`);
        }
    }

    return res.status(404).json({ success: false, message: 'Ruta OAuth no encontrada' });
};
