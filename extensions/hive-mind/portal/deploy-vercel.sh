#!/bin/bash
# Deploy OpenClaw Portal to Vercel
# First time: run without --prod to create the project and link it
# After that: run with --prod for production deploys

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HTDOCS="$SCRIPT_DIR/htdocs"

if [ ! -f "$HTDOCS/index.html" ]; then
  echo "Error: htdocs/index.html not found"
  exit 1
fi

cd "$HTDOCS"

if [ "$1" = "--setup" ]; then
  echo "Setting up Vercel project..."
  echo "Follow the prompts to link this directory to a Vercel project."
  npx vercel
  echo ""
  echo "Project linked. Now run: $0 --prod"
  echo ""
  echo "Next steps:"
  echo "  1. Copy Org ID and Project ID from .vercel/project.json"
  echo "  2. Add these as GitHub secrets: VERCEL_ORG_ID, VERCEL_PROJECT_ID"
  echo "  3. Add your Vercel token as: VERCEL_TOKEN"
  echo "  4. (Optional) Set BACKEND_URL env var in Vercel dashboard for API proxy"
else
  echo "Deploying to Vercel production..."
  npx vercel --prod
fi
