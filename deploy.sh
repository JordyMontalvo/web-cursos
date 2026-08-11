#!/bin/bash

echo "🚀 Iniciando despliegue automatizado..."

# 1. Subir cambios a GitHub
echo "📦 Subiendo cambios a GitHub..."
git add .
git commit -m "Auto-deploy: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin master

# 2. Transferir archivos al servidor EC2
echo "☁️ Transfiriendo archivos al servidor de AWS (excluyendo node_modules y .git)..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ../iatibet.pem" \
    --exclude 'node_modules' \
    --exclude '.git' \
    ./ ubuntu@ec2-34-238-116-244.compute-1.amazonaws.com:/home/ubuntu/web-cursos-platform/

# 3. Reiniciar PM2 en el servidor
echo "🔄 Reiniciando la aplicación en el servidor..."
ssh -o StrictHostKeyChecking=no -i ../iatibet.pem ubuntu@ec2-34-238-116-244.compute-1.amazonaws.com "cd /home/ubuntu/web-cursos-platform && npm install && pm2 restart web-cursos --update-env"

echo "✅ ¡Despliegue completado con éxito!"
