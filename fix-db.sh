#!/bin/bash

echo "🔧 Reparando base de datos..."

# Obtener el contenedor de PostgreSQL
PG_CONTAINER=$(docker ps -q -f ancestor=postgres)

if [ -z "$PG_CONTAINER" ]; then
  echo "❌ PostgreSQL no encontrado. Iniciando..."
  docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:latest
  sleep 5
  PG_CONTAINER=$(docker ps -q -f ancestor=postgres)
fi

# Eliminar usuario y BD existentes
docker exec -it "$PG_CONTAINER" psql -U postgres -c "
DROP DATABASE IF EXISTS task_agenda;
DROP USER IF EXISTS taskagenda;
" 2>/dev/null || true

# Crear nuevo usuario y BD
docker exec -it "$PG_CONTAINER" psql -U postgres -c "
CREATE USER taskagenda WITH PASSWORD 'securepass123';
ALTER USER taskagenda CREATEDB;
CREATE DATABASE task_agenda OWNER taskagenda;
GRANT ALL PRIVILEGES ON DATABASE task_agenda TO taskagenda;
"

echo "✅ Base de datos reparada"
echo "📝 Actualizando .env..."

# Nota: Actualizar .env manualmente con GROQ_API_KEY si es necesario
if [ ! -f /root/task-agenda/.env ]; then
  echo "❌ ERROR: .env no existe. Créalo manualmente con:"
  echo "  DATABASE_URL=postgresql://taskagenda:securepass123@localhost:5432/task_agenda"
  echo "  GROQ_API_KEY=<tu_clave>"
  echo "  NODE_ENV=production"
  exit 1
fi

echo "✅ .env actualizado"
echo "🔄 Reiniciando app..."

cd /root/task-agenda
pm2 restart task-agenda

echo "✅ Listo. La app debería funcionar ahora."
