#!/bin/bash

# Setup auto-update cron job (ejecutar una sola vez en el droplet)

echo "⏰ Configurando auto-update cada 5 minutos..."

# Hacer el script ejecutable
chmod +x /root/task-agenda/auto-update.sh

# Crear archivo de log
touch /var/log/task-agenda-autoupdate.log
chmod 666 /var/log/task-agenda-autoupdate.log

# Agregar cron job (cada 5 minutos)
CRON_JOB="*/5 * * * * /root/task-agenda/auto-update.sh"

# Verificar si el cron ya existe
if ! crontab -l 2>/dev/null | grep -q "auto-update.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✅ Cron job agregado exitosamente"
  echo "   La app se actualizará automáticamente cada 5 minutos"
  echo ""
  echo "📊 Ver logs: tail -f /var/log/task-agenda-autoupdate.log"
else
  echo "⚠️  El cron job ya existe"
fi
