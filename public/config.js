// ===================================
// Configuración de API
// ===================================
// En localhost: rutas relativas (servidor Express local)
// En Vercel: llama a /api/config para obtener BACKEND_URL

let API_BASE = '';

// Promesa que resuelve cuando la config está lista
const configReady = (async () => {
    // FORZAMOS RUTAS RELATIVAS:
    // Esto garantiza que en Vercel se usen las Funciones Serverless del proyecto
    // y no se redirija a un servidor externo (EC2) que pueda estar desactualizado.
    API_BASE = '';
    
    // Opcional: seguimos cargando el config por si se usa para otros fines,
    // pero ya no sobreescribimos API_BASE.
    try {
        await fetch('/api/config');
    } catch (e) {
        // Ignorar errores
    }
})();

function apiUrl(path) {
    return `${API_BASE}${path}`;
}
