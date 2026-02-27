#!/usr/bin/env bash
# Usage: ./scripts/update-redis-env.sh <REDIS_PASSWORD>
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <REDIS_PASSWORD>"
  exit 2
fi

REDIS_PASSWORD="$1"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

cat > "$ENV_FILE" <<EOF
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
EOF

echo "Wrote $ENV_FILE (do NOT commit this file with secrets)."
echo "Run: ./scripts/redeploy.sh to restart services."
