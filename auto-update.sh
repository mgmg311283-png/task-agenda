#!/bin/bash

# Auto-update script: checks GitHub every 5 min and deploys if changes exist

REPO_PATH="/root/task-agenda"
BRANCH="claude/task-agenda-free-ai-model-ujsy2a"
LOG_FILE="/var/log/task-agenda-autoupdate.log"

cd "$REPO_PATH"

# Fetch latest changes from GitHub
git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

# Check if local branch is behind remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date)] Cambios detectados. Actualizando..." >> "$LOG_FILE"

  # Pull latest code
  git pull origin "$BRANCH" >> "$LOG_FILE" 2>&1

  # Install & build
  npm install >> "$LOG_FILE" 2>&1
  npm run build >> "$LOG_FILE" 2>&1

  # Restart PM2 app
  pm2 restart task-agenda >> "$LOG_FILE" 2>&1

  echo "[$(date)] ✅ Actualización completada" >> "$LOG_FILE"
else
  echo "[$(date)] Sin cambios" >> "$LOG_FILE"
fi
