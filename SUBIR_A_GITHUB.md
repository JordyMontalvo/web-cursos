# 🚀 Subir a GitHub - Guía Paso a Paso

## ✅ Estado Actual
- ✅ Repositorio Git inicializado
- ✅ Commits creados
- ✅ Proyecto listo para subir

## 📋 Opción 1: Crear Repositorio en GitHub Web (Recomendado)

### Paso 1: Crear Repositorio en GitHub

1. Ve a https://github.com/new
2. Configura el repositorio:
   - **Repository name**: `web-cursos` (o el nombre que prefieras)
   - **Description**: `Plataforma de cursos online IATIBET ZUREON con panel admin`
   - **Visibility**: Público o Privado (tu elección)
   - ⚠️ **NO marques**: "Initialize this repository with a README"
   - ⚠️ **NO agregues**: .gitignore ni licencia (ya los tenemos)

3. Clic en **"Create repository"**

### Paso 2: Conectar tu Repositorio Local

Copia y ejecuta estos comandos (GitHub te los mostrará después de crear el repo):

```bash
cd /Users/jordymontalvo/Documents/web-cursos
git remote add origin https://github.com/TU-USUARIO/web-cursos.git
git branch -M main
git push -u origin main
```

**Importante**: Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub.

### Paso 3: Verificar

Después de hacer push, recarga la página de GitHub. Deberías ver todos tus archivos allí.

---

## 📋 Opción 2: Usar GitHub CLI (Más Rápido)

Si tienes GitHub CLI instalado:

```bash
# Autenticarse (solo la primera vez)
gh auth login

# Crear repositorio y hacer push en un solo comando
gh repo create web-cursos --public --source=. --remote=origin --push
```

Si no tienes GitHub CLI:

```bash
brew install gh
```

---

## 🔐 Autenticación

GitHub ya NO acepta contraseñas. Necesitas usar:

### Opción A: Personal Access Token
1. Ve a https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Selecciona permisos: `repo`
4. Copia el token
5. Úsalo como contraseña cuando hagas `git push`

### Opción B: SSH (Recomendado)

```bash
# Generar clave SSH (si no tienes una)
ssh-keygen -t ed25519 -C "tu-email@example.com"

# Copiar la clave pública
cat ~/.ssh/id_ed25519.pub

# Agregar en GitHub: Settings → SSH and GPG keys → New SSH key
```

Luego usa URL SSH en lugar de HTTPS:

```bash
git remote set-url origin git@github.com:TU-USUARIO/web-cursos.git
```

---

## 🎯 Comandos Rápidos de Referencia

```bash
# Ver estado del repositorio
git status

# Ver remotes configurados
git remote -v

# Cambiar a branch main (si estás en master)
git branch -M main

# Hacer push
git push -u origin main

# Agregar cambios futuros
git add .
git commit -m "Mensaje descriptivo"
git push
```

---

## ⚡ Siguiente Paso: Desplegar en Vercel

Una vez que tu código esté en GitHub:

### Método 1: Desde Vercel Dashboard
1. Ve a https://vercel.com
2. Clic en "New Project"
3. Importa tu repositorio de GitHub
4. Vercel detectará automáticamente la configuración
5. Clic en "Deploy"

### Método 2: Desde CLI
```bash
vercel --prod
```

---

## 🐛 Solución de Problemas

### Error: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/TU-USUARIO/web-cursos.git
```

### Error: Authentication failed
- Usa un Personal Access Token en lugar de contraseña
- O configura SSH (ver sección de autenticación arriba)

### Error: "failed to push some refs"
```bash
# Si el repositorio remoto tiene commits que no tienes localmente
git pull origin main --rebase
git push -u origin main
```

---

## 📝 Notas

- El `.gitignore` ya está configurado para excluir `node_modules`, `data/`, etc.
- La carpeta `uploads/` se excluye (excepto `default-course.jpg`)
- El archivo `vercel.json` está listo para despliegue automático

---

## ✨ Después de Subir a GitHub

1. **Agregar Topics** en GitHub:
   - nodejs, express, vercel, course-platform, education

2. **Actualizar README** con la URL real:
   - Reemplaza `tu-usuario` con tu usuario real
   - Agrega capturas de pantalla en `docs/`

3. **Desplegar en Vercel** (automático si conectas GitHub)

---

¿Listo para subir? Copia los comandos del **Paso 2** después de crear tu repositorio en GitHub! 🚀
