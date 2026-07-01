#!/bin/bash
set -e

echo "🚀 Iniciando deployment de task-agenda..."

# 1. Verificar que .env existe con variables requeridas
if [ ! -f .env ]; then
  echo "❌ ERROR: .env no existe"
  echo "Crea .env con estas variables:"
  echo "  DATABASE_URL=postgresql://taskagenda:securepass123@localhost:5432/task_agenda"
  echo "  GROQ_API_KEY=<tu_groq_key>"
  echo "  NODE_ENV=production"
  exit 1
fi
echo "✓ .env encontrado"

# 2. Crear BD en PostgreSQL
echo "🗄️  Configurando base de datos..."
docker exec -it $(docker ps -q -f ancestor=postgres) psql -U postgres -c "
CREATE USER IF NOT EXISTS taskagenda WITH PASSWORD 'securepass123';
ALTER USER taskagenda CREATEDB;
CREATE DATABASE IF NOT EXISTS task_agenda OWNER taskagenda;
GRANT ALL PRIVILEGES ON DATABASE task_agenda TO taskagenda;
" 2>/dev/null || echo "⚠️  BD ya existe o error (continuando...)"

# 3. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 4. Build
echo "🔨 Construyendo app..."
npm run build

# 5. Instalar PM2 globalmente
echo "⚙️  Configurando PM2..."
npm install -g pm2 2>/dev/null || echo "PM2 ya instalado"

# 6. Detener app anterior si existe
pm2 delete task-agenda 2>/dev/null || echo "Primera vez"

# 7. Iniciar app
pm2 start dist/index.cjs --name task-agenda --port 5000
pm2 save
pm2 startup

echo ""
echo "✅ DEPLOYMENT COMPLETADO"
echo "🌐 App disponible en: http://206.81.13.53:5000"
echo "📊 Ver logs: pm2 logs task-agenda"
