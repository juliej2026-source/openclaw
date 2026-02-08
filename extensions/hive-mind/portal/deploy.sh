#!/bin/bash
# OpenClaw Hive Mind Portal — Deployment Script
# Usage: bash deploy.sh [/opt/openclaw-portal]

set -euo pipefail

DEST="${1:-/opt/openclaw-portal}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[portal] Deploying to $DEST ..."

sudo mkdir -p "$DEST"
sudo cp -r "$SCRIPT_DIR/htdocs" "$DEST/"
sudo chown -R www-data:www-data "$DEST/htdocs"

echo "[portal] Installing Apache vhost ..."
sudo cp "$SCRIPT_DIR/httpd.conf" /etc/apache2/sites-available/hivemind.conf

# Adjust DocumentRoot if a custom destination was given
if [ "$DEST" != "/opt/openclaw-portal" ]; then
  sudo sed -i "s|/opt/openclaw-portal|$DEST|g" /etc/apache2/sites-available/hivemind.conf
fi

sudo a2dissite 000-default 2>/dev/null || true
sudo a2ensite hivemind

echo "[portal] Testing Apache config ..."
sudo apache2ctl configtest

echo "[portal] Reloading Apache ..."
sudo systemctl reload apache2

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "[portal] Deployed successfully!"
echo "[portal] Open http://$IP/ in your browser"
