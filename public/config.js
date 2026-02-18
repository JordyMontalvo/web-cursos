// ===================================
// Configuración de API
// ===================================
// En localhost: rutas relativas (servidor Express local)
// En Vercel: llama a /api/config para obtener BACKEND_URL

let API_BASE = '';

// Promesa que resuelve cuando la config está lista
const configReady = (async () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_BASE = '';
        return;
    }
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        API_BASE = (data.apiUrl || '').replace(/\/$/, ''); // quitar trailing slash
    } catch (e) {
        console.warn('[config] No se pudo cargar BACKEND_URL, usando rutas relativas');
        API_BASE = '';
    }
})();

function apiUrl(path) {
    return `${API_BASE}${path}`;
}
