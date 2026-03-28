// ===================================
// Configuración de API
// ===================================
// En localhost: rutas relativas (servidor Express local)
// En Vercel: llama a /api/config para obtener BACKEND_URL

let API_BASE = '';
let IZIPAY_PUBLIC_KEY = '';
let IZIPAY_SHOP_ID = '';

// Promesa que resuelve cuando la config está lista
const configReady = (async () => {
    // FORZAMOS RUTAS RELATIVAS:
    API_BASE = '';
    
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.izipayPublicKey) IZIPAY_PUBLIC_KEY = data.izipayPublicKey;
        if (data.izipayShopId) IZIPAY_SHOP_ID = data.izipayShopId;
    } catch (e) {
        console.error('Error loading config:', e);
    }
})();

function apiUrl(path) {
return `${API_BASE}${path}`;
}
