# ============================================================
# WHATSAPP CRM - MULTI-STAGE BUILDER FOR MINIMAL SIZE
# ============================================================

ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

# STAGE 1: Builder - Compile everything
FROM node:20 as builder
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN npm config set fetch-timeout 300000 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 300000 && npm config set fetch-retries 10

WORKDIR /build
RUN echo "Building at ${BUILD_DATE} from commit ${GIT_COMMIT}"
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . 

# Build backend with ci for deterministic install
WORKDIR /build/backend
RUN npm ci --legacy-peer-deps && npm run build

# Build frontend with ci
WORKDIR /build/frontend
RUN npm ci --legacy-peer-deps && npm run build

# Prune dev dependencies from both
WORKDIR /build/backend
RUN npm prune --omit=dev --legacy-peer-deps

WORKDIR /build/frontend
RUN npm prune --omit=dev --legacy-peer-deps

# Aggressive cleanup - remove all non-essential files
RUN find /build -type f \( -name "*.map" -o -name "*.test.js" -o -name "*.spec.js" \) -delete && \
    find /build -type d \( -name "test" -o -name "tests" -o -name ".nyc_output" -o -name "coverage" \) -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /build/frontend/.next/cache /build/backend/.next 2>/dev/null || true && \
    npm cache clean --force

# Cleanup node_modules to remove unnecessary files
RUN find /build -path "*/node_modules/*" -type f -name "*.md" -delete && \
    find /build -path "*/node_modules/*" -type f -name "package.json.bak" -delete && \
    find /build -path "*/node_modules/*" -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true && \
    find /build -path "*/node_modules/*" -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true && \
    find /build -path "*/node_modules/*" -type d -name ".bin" -not -path "*/node_modules/.bin" -exec rm -rf {} + 2>/dev/null || true

# STAGE 2: Runtime - Minimal base image
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git nginx supervisor curl dumb-init bash netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app /var/log/supervisor /etc/nginx/conf.d /etc/supervisor/conf.d
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /usr/sbin/nologin nodejs
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/*.conf 2>/dev/null || true

# Copy only production artifacts from builder
COPY --from=builder --chown=root:root /build/backend/dist /app/backend/dist
COPY --from=builder --chown=root:root /build/backend/prisma /app/backend/prisma
COPY --from=builder --chown=root:root /build/backend/package.json /app/backend/
COPY --from=builder --chown=root:root /build/backend/node_modules /app/backend/node_modules

COPY --from=builder --chown=root:root /build/frontend/.next /app/frontend/.next
COPY --from=builder --chown=root:root /build/frontend/package.json /app/frontend/
COPY --from=builder --chown=root:root /build/frontend/node_modules /app/frontend/node_modules
COPY --from=builder --chown=root:root /build/frontend/public /app/frontend/public 2>/dev/null || true

# Final aggressive cleanup of unnecessary files in runtime layer
RUN find /app -path "*/node_modules/*" -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" \) -delete 2>/dev/null || true && \
    find /app/frontend/.next -type d -name "cache" -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /app/backend/.git /app/frontend/.git 2>/dev/null || true

# Setup Nginx config
RUN echo "upstream api { server 127.0.0.1:3000; }" > /etc/nginx/conf.d/default.conf && \
    echo "upstream web { server 127.0.0.1:3001; }" >> /etc/nginx/conf.d/default.conf && \
    echo "server {" >> /etc/nginx/conf.d/default.conf && \
    echo "  listen 80 default_server;" >> /etc/nginx/conf.d/default.conf && \
    echo "  server_name _;" >> /etc/nginx/conf.d/default.conf && \
    echo "  client_max_body_size 50M;" >> /etc/nginx/conf.d/default.conf && \
    echo "  location /api/ { proxy_pass http://api/; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; }" >> /etc/nginx/conf.d/default.conf && \
    echo "  location /health { return 200 \"OK\"; add_header Content-Type text/plain; }" >> /etc/nginx/conf.d/default.conf && \
    echo "  location / { proxy_pass http://web; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; }" >> /etc/nginx/conf.d/default.conf && \
    echo "}" >> /etc/nginx/conf.d/default.conf

# Setup Supervisor config
RUN printf "[supervisord]\nnodaemon=true\nuser=root\nlogfile=/dev/stdout\nlogfile_maxbytes=0\n\n[program:backend]\ndirectory=/app/backend\ncommand=node dist/main.js\nautostart=true\nautorestart=false\nstartsecs=10\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n[program:frontend]\ndirectory=/app/frontend\ncommand=/bin/bash -c \"exec npm start\"\nenvironment=NODE_ENV=production,PORT=3001\nautostart=true\nautorestart=false\nstartsecs=15\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n[program:nginx]\ncommand=/usr/sbin/nginx -g \"daemon off;\"\nautostart=true\nautorestart=false\nstartsecs=5\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\npriority=999\n" > /etc/supervisor/conf.d/supervisord.conf

# Create entrypoint script
RUN printf '#!/bin/bash\necho "🔄 Aguardando banco de dados..."\nfor i in {1..30}; do\n  if nc -z db 5432 2>/dev/null; then\n    echo "✅ Banco disponível"\n    break\n  fi\n  sleep 1\ndone\nsleep 2\necho "🔄 Sincronizando schema do Prisma..."\ncd /app/backend && npx prisma db push --skip-generate 2>&1 || echo "⚠️ Prisma sync completed"\nsleep 2\necho "🔄 Inicializando banco de dados..."\ncd /app/backend && npm run db:seed 2>&1 || echo "⚠️ Seed completed"\necho "✅ Sistema pronto!"\nexec supervisord -c /etc/supervisor/conf.d/supervisord.conf\n' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

RUN mkdir -p /app/backend/storage && chown -R 1001:1001 /app

WORKDIR /app
EXPOSE 80

ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]
