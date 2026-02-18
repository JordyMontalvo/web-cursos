// ===================================
// Configuración de API
// ===================================
// En Vercel, el frontend y la API están en el mismo dominio.
// En local, el servidor Express corre en el mismo origen.
// Por eso siempre usamos rutas relativas.

const API_BASE = '';

function apiUrl(path) {
    return `${API_BASE}${path}`;
}
