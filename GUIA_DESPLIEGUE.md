# Guía de Despliegue para AWS EC2

Esta guía explica el flujo de trabajo para actualizar y desplegar la aplicación `web-cursos-platform` en tu servidor de Amazon Web Services (AWS EC2).

## Flujo de Trabajo Automatizado (Recomendado)

Hemos configurado un script llamado `deploy.sh` que automatiza todo el proceso. Cada vez que hagas cambios en el código de tu proyecto, solo debes seguir estos pasos:

1. Abre la terminal de VS Code (asegúrate de estar en la carpeta `web-cursos`).
2. Ejecuta el script de despliegue:
   ```bash
   ./deploy.sh
   ```

### ¿Qué hace exactamente `deploy.sh`?
El script se encarga de tres cosas fundamentales en un solo paso:
- **Git Push:** Añade todos los archivos modificados, crea un commit con la fecha/hora actual y los sube a la rama `master` de tu repositorio en GitHub.
- **Rsync (Transferencia):** Se conecta a tu instancia de AWS (usando el archivo `iatibet.pem`) y copia únicamente los archivos que cambiaron. Ignora automáticamente las carpetas pesadas o innecesarias (como `node_modules` y `.git`).
- **Reinicio (PM2):** Finalmente, ejecuta un comando remoto en el servidor para decirle a PM2 (el administrador de tareas) que instale nuevas dependencias (si hay alguna) y reinicie la aplicación aplicando las nuevas variables de entorno de tu archivo `.env`.

---

## Modificación de Variables de Entorno

Si en el futuro necesitas cambiar credenciales (por ejemplo, la URL de tu base de datos de MongoDB o claves secretas), debes hacerlo modificando el archivo local llamado `.env` en la raíz de tu proyecto.

> [!WARNING]
> **Nunca subas el archivo `.env` a GitHub.** El archivo `.gitignore` ya está configurado para ignorarlo. El script de despliegue `deploy.sh` sube este archivo de manera segura *directamente* al servidor EC2 saltándose GitHub.

---

## Comandos Útiles en el Servidor

Si alguna vez necesitas revisar qué está pasando dentro del servidor, primero debes conectarte por SSH desde tu terminal:

```bash
ssh -i "../iatibet.pem" ubuntu@ec2-34-238-116-244.compute-1.amazonaws.com
```

Una vez dentro del servidor, aquí tienes los comandos principales:

### Ver los errores o actividad en vivo:
```bash
pm2 logs web-cursos
```

### Reiniciar la aplicación manualmente:
```bash
pm2 restart web-cursos
```

### Apagar la aplicación:
```bash
pm2 stop web-cursos
```

### Ver el consumo de RAM y CPU de la app:
```bash
pm2 monit
```

### Reiniciar el servidor Nginx (El encargado de mostrar la app en el puerto 80):
```bash
sudo systemctl restart nginx
```
