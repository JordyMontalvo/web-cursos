# 🎓 IATIBET ZUREON - Plataforma de Cursos Online

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tu-usuario/web-cursos)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)

Una moderna plataforma de cursos online con diseño vibrante púrpura/magenta, panel de administración completo y API REST.

## 🌟 Demo en Vivo

- **Sitio Principal**: [Ver Demo](https://tu-proyecto.vercel.app)
- **Panel Admin**: [Ver Admin](https://tu-proyecto.vercel.app/admin)

> ⚠️ Después de desplegar, actualiza estos enlaces con tu URL de Vercel

## 📸 Capturas de Pantalla

### Página Principal
![Página Principal](docs/screenshot-home.png)

### Panel de Administración
![Panel Admin](docs/screenshot-admin.png)

## ✨ Características

### Frontend (Sitio Público)

- ✅ Diseño moderno con gradientes púrpura/magenta vibrantes
- ✅ Tarjetas de cursos animadas con efectos 3D hover
- ✅ Sistema de filtros por categoría y especialización
- ✅ Búsqueda en tiempo real
- ✅ Página de detalle de curso con reproductor de video
- ✅ Diseño completamente responsivo
- ✅ Animaciones suaves y micro-interacciones

### Panel de Administración

- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión completa de cursos (CRUD)
- ✅ Subida de imágenes para miniaturas
- ✅ Editor de contenido intuitivo
- ✅ Búsqueda y filtrado de cursos
- ✅ Notificaciones toast
- ✅ Marcar cursos como destacados

## 🚀 Instalación

### Requisitos Previos

- Node.js (v14 o superior)
- npm o yarn

### Pasos de Instalación

1. **Clonar o navegar al directorio del proyecto**

   ```bash
   cd /Users/jordymontalvo/Documents/web-cursos
   ```

2. **Instalar dependencias**

   ```bash
   npm install
   ```

3. **Iniciar el servidor**

   ```bash
   npm start
   ```

   O en modo desarrollo con auto-restart:

   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   - Sitio principal: http://localhost:3000
   - Panel de administración: http://localhost:3000/admin

## 📁 Estructura del Proyecto

```
web-cursos/
├── server.js                 # Servidor Express con API REST
├── package.json              # Dependencias del proyecto
├── data/
│   └── courses.json         # Base de datos JSON de cursos
├── uploads/                 # Imágenes subidas
└── public/                  # Archivos estáticos (frontend)
    ├── index.html          # Página principal
    ├── curso.html          # Página de detalle de curso
    ├── admin.html          # Panel de administración
    ├── styles.css          # Estilos principales
    ├── admin-styles.css    # Estilos del panel admin
    ├── script.js           # JavaScript del sitio público
    └── admin-script.js     # JavaScript del panel admin
```

## 🔌 API Endpoints

### Cursos

#### Obtener todos los cursos

```
GET /api/courses
```

#### Obtener un curso específico

```
GET /api/courses/:id
```

#### Crear nuevo curso

```
POST /api/courses
Content-Type: application/json

{
  "name": "Nombre del Curso",
  "category": "FINANZA",
  "chapters": 30,
  "episodes": 90,
  "videoUrl": "https://youtube.com/embed/...",
  "thumbnail": "/uploads/imagen.jpg",
  "description": "Descripción del curso",
  "featured": true
}
```

#### Actualizar curso

```
PUT /api/courses/:id
Content-Type: application/json

{
  "name": "Nuevo nombre",
  ...
}
```

#### Eliminar curso

```
DELETE /api/courses/:id
```

### Subir Imagen

```
POST /api/upload
Content-Type: multipart/form-data

{
  "image": <file>
}
```

## 🎨 Categorías Disponibles

- FINANZA
- DESARROLLO
- MARKETING
- DISEÑO
- NEGOCIOS
- PERSONAL

## 📝 Uso del Panel de Administración

### Añadir un Nuevo Curso

1. Clic en "Nuevo Curso"
2. Rellenar el formulario:
   - Nombre del curso (requerido)
   - Categoría (requerido)
   - Número de capítulos (requerido)
   - Número de episodios (requerido)
   - Descripción (opcional)
   - URL del video (opcional)
   - Subir miniatura (opcional)
   - Marcar como destacado (opcional)
3. Clic en "Guardar Curso"

### Editar un Curso

1. Buscar el curso en la tabla
2. Clic en el botón de editar (lápiz azul)
3. Modificar los campos deseados
4. Clic en "Guardar Curso"

### Eliminar un Curso

1. Buscar el curso en la tabla
2. Clic en el botón de eliminar (papelera roja)
3. Confirmar la eliminación

## 🎥 URLs de Video Soportadas

El campo "URL del Video" acepta enlaces de:

- YouTube (formato embed): `https://www.youtube.com/embed/VIDEO_ID`
- Vimeo (formato embed): `https://player.vimeo.com/video/VIDEO_ID`
- Cualquier URL de video embebido

## 🖼️ Imágenes

- **Formatos aceptados**: JPG, PNG, GIF, WebP
- **Tamaño máximo**: 5MB
- **Resolución recomendada**: 1280x720px (16:9)

## 🔧 Tecnologías Utilizadas

### Backend

- Express.js - Framework web
- Multer - Manejo de archivos
- Body-parser - Parsing de datos
- CORS - Cross-Origin Resource Sharing

### Frontend

- HTML5 - Estructura
- CSS3 - Estilos (con variables CSS y gradientes)
- JavaScript (Vanilla) - Lógica del cliente
- Google Fonts (Inter) - Tipografía

### Base de Datos

- JSON file-based database (simple y efectiva)

## 📱 Responsive Design

La plataforma está optimizada para:

- 📱 Móviles (< 768px)
- 💻 Tablets (768px - 1024px)
- 🖥️ Desktop (> 1024px)

## ⚡ Rendimiento

- Lazy loading de imágenes
- Animaciones CSS optimizadas
- Código minificado en producción
- Carga asíncrona de datos

## 🎯 Próximas Características

- [ ] Autenticación de usuarios
- [ ] Sistema de comentarios
- [ ] Progreso del curso
- [ ] Certificados de finalización
- [ ] Integración con pasarelas de pago
- [ ] Dashboard de estudiantes
- [ ] Sistema de calificaciones

## 📞 Soporte

Para cualquier problema o pregunta, contacta al administrador del sistema.

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

---

Desarrollado con ❤️ para IATIBET ZUREON
# web-cursos
