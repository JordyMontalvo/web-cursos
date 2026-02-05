# 🚀 Despliegue en Vercel

## Guía de Despliegue Paso a Paso

### Opción 1: Despliegue desde la CLI de Vercel (Recomendado)

1. **Instalar Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Iniciar sesión en Vercel**
   ```bash
   vercel login
   ```

3. **Desplegar el proyecto**
   ```bash
   cd /Users/jordymontalvo/Documents/web-cursos
   vercel
   ```
   
   - Sigue las instrucciones en pantalla
   - Cuando pregunte por el directorio, presiona Enter (usa el actual)
   - Confirma la configuración del proyecto
   
4. **Para producción**
   ```bash
   vercel --prod
   ```

### Opción 2: Despliegue desde GitHub

1. **Sube tu código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/tu-repositorio.git
   git push -u origin main
   ```

2. **Conecta con Vercel**
   - Ve a https://vercel.com
   - Clic en "New Project"
   - Importa tu repositorio de GitHub
   - Vercel detectará automáticamente la configuración

### ⚠️ Limitaciones en Vercel

#### 🗄️ Base de Datos
La base de datos JSON actual **NO persiste** en Vercel porque usa `/tmp` que se limpia entre peticiones.

**Soluciones recomendadas:**
1. **Vercel KV** (Redis) - Incluido gratis
2. **MongoDB Atlas** - Base de datos en la nube
3. **Supabase** - PostgreSQL gratis
4. **Planetscale** - MySQL serverless

#### 📸 Almacenamiento de Imágenes
Los uploads NO persisten en Vercel (filesystem efímero).

**Soluciones recomendadas:**
1. **Cloudinary** - CDN de imágenes (gratis hasta 25GB)
2. **AWS S3** - Almacenamiento en la nube
3. **Vercel Blob Storage** - Almacenamiento de Vercel
4. **Uploadcare** - CDN especializado

### 🔧 Configuración Actual

El archivo `vercel.json` ya está configurado para:
- ✅ Servir archivos estáticos desde `/public`
- ✅ Rutas dinámicas (`/admin`, `/curso/:id`)
- ✅ API serverless en `/api`
- ✅ CORS habilitado

### 📝 Rutas Disponibles

Después del despliegue, tendrás:
- `https://tu-proyecto.vercel.app/` - Página principal
- `https://tu-proyecto.vercel.app/admin` - Panel de administración
- `https://tu-proyecto.vercel.app/curso/1` - Página de curso
- `https://tu-proyecto.vercel.app/api/courses` - API de cursos

### 🐛 Solución al Error 404 en `/admin`

El error 404 que experimentaste se debe a que Vercel necesita el archivo `vercel.json` para configurar las rutas correctamente. Con la configuración actual:

```json
{
  "src": "/admin",
  "dest": "/public/admin.html"
}
```

Esto redirige `/admin` al archivo HTML correcto.

### ✅ Verificar Despliegue

Después de desplegar, verifica:
1. Página principal carga correctamente
2. `/admin` muestra el panel de administración
3. La API responde en `/api/courses`
4. Los estilos se cargan correctamente

### 🚨 Nota Importante sobre Persistencia

**IMPORTANTE:** La versión actual usa almacenamiento temporal. Los cursos creados **se perderán** cuando Vercel reinicie las funciones serverless.

Para producción, debes migrar a:
- Una base de datos real (MongoDB, PostgreSQL, etc.)
- Almacenamiento de imágenes externo (Cloudinary, S3, etc.)

### 📦 Variables de Entorno (Opcional)

Si necesitas configurar variables de entorno:

1. En Vercel Dashboard:
   - Settings → Environment Variables
   
2. O desde CLI:
   ```bash
   vercel env add NOMBRE_VARIABLE
   ```

### 🎯 Próximos Pasos Recomendados

1. **Migrar a MongoDB Atlas** (gratis)
   ```bash
   npm install mongodb
   ```

2. **Integrar Cloudinary** para imágenes
   ```bash
   npm install cloudinary
   ```

3. **Añadir autenticación** con Vercel + NextAuth

---

¿Necesitas ayuda para migrar a una base de datos real? Puedo ayudarte a integrar MongoDB Atlas o Supabase.
