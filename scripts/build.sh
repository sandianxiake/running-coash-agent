#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 如果设置了环境变量，创建 .env.production 文件
if [ -n "${VITE_DEEPSEEK_API_KEY:-}" ]; then
  echo "Creating .env.production from environment variable..."
  cat > .env.production << EOF
# 生产环境 API Key
VITE_DEEPSEEK_API_KEY=$VITE_DEEPSEEK_API_KEY
EOF
fi

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building frontend with Vite..."
pnpm vite build
