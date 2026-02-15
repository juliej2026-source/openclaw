#!/bin/bash
# Quick Cloudflare tunnel for OpenClaw Hive Mind
# Runs cloudflared and captures the public URL to a file

URL_FILE="/tmp/openclaw-tunnel-url.txt"
LOG_FILE="/tmp/openclaw-tunnel.log"

# Clean up old files
rm -f "$URL_FILE" "$LOG_FILE"

# Start cloudflared and tee output to log
cloudflared tunnel --url http://localhost:80 2>&1 | while IFS= read -r line; do
  echo "$line" >> "$LOG_FILE"

  # Extract the trycloudflare.com URL
  if echo "$line" | grep -qo 'https://[a-z0-9-]*\.trycloudflare\.com'; then
    URL=$(echo "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')
    echo "$URL" > "$URL_FILE"
    echo "[openclaw-tunnel] Public URL: $URL" >> "$LOG_FILE"
  fi
done
