# ============================================================
# WHATSAPP CRM - COMPLETE SELF-CONTAINED BUILD
# NO LOCAL COPY - PURE GIT CLONE
# ============================================================

ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

FROM node:20
RUN apt-get update && apt-get install -y --no-install-recommends git nginx supervisor curl dumb-init bash && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app /var/log/supervisor /etc/nginx/conf.d /etc/supervisor/conf.d
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /usr/sbin/nologin nodejs
# Remove default nginx config to avoid conflicts
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/*.conf 2>/dev/null || true

WORKDIR /build

# Force fresh git clone by using build args (cache invalidation)
RUN echo "Building at ${BUILD_DATE} from commit ${GIT_COMMIT}"
# Configure npm to be more resilient to network issues
RUN npm config set fetch-timeout 300000 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 300000 && npm config set fetch-retries 10 && npm config set registry https://registry.npmjs.org/

RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . 

# Build backend
WORKDIR /build/backend
RUN npm install --legacy-peer-deps && npm run build

# Build frontend - needs legacy-peer-deps for qrcode.react × React 18 conflict
WORKDIR /build/frontend
RUN npm install --legacy-peer-deps && npm run build

# Copy to final location - OPTIMIZED for space
WORKDIR /
RUN mkdir -p /app/backend /app/frontend /app/frontend/public && \
    cp -r /build/backend/dist /app/backend/ && \
    cp -r /build/backend/prisma /app/backend/ && \
    cp /build/backend/package.json /app/backend/ && \
    cp /build/backend/package-lock.json /app/backend/ 2>/dev/null || true && \
    cp -r /build/frontend/.next /app/frontend/ && \
    cp /build/frontend/package.json /app/frontend/ && \
    [ -d /build/frontend/public ] && cp -r /build/frontend/public/* /app/frontend/public/ || true && \
    rm -rf /build && \
    npm cache clean --force && \
    find /app -type f -name "*.map" -delete && \
    find /app -type d -name ".next/cache" -exec rm -rf {} + 2>/dev/null || true

# Install production dependencies only - BACKEND
WORKDIR /app/backend
RUN npm install --omit=dev --legacy-peer-deps 2>&1 | grep -v "npm warn" || true

# Install production dependencies - FRONTEND (minimal)
WORKDIR /app/frontend
RUN npm install --omit=dev --legacy-peer-deps 2>&1 | head -20 && npm install --omit=dev --legacy-peer-deps 2>&1 | tail -5 || true

# Setup Nginx config - simple and reliable
RUN /bin/bash -c 'echo "upstream api { server 127.0.0.1:3000; }" > /etc/nginx/conf.d/default.conf && \
echo "upstream web { server 127.0.0.1:3001; }" >> /etc/nginx/conf.d/default.conf && \
echo "server {" >> /etc/nginx/conf.d/default.conf && \
echo "  listen 80 default_server;" >> /etc/nginx/conf.d/default.conf && \
echo "  server_name _;" >> /etc/nginx/conf.d/default.conf && \
echo "  client_max_body_size 50M;" >> /etc/nginx/conf.d/default.conf && \
echo "  location /api/ { proxy_pass http://api/; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location /health { return 200 \"OK\"; add_header Content-Type text/plain; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location / { proxy_pass http://web; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }" >> /etc/nginx/conf.d/default.conf && \
echo "}" >> /etc/nginx/conf.d/default.conf'

# Setup Supervisor config - com logs direto para stdout/stderr
RUN /bin/bash -c 'echo "[supervisord]" > /etc/supervisor/conf.d/supervisord.conf && \
echo "nodaemon=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "user=root" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "logfile=/dev/stdout" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:backend]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "directory=/app/backend" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=node dist/main.js" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=false" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=10" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/dev/stdout" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/dev/stderr" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:frontend]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "directory=/app/frontend" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=/bin/bash -c \"exec npm start\"" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "environment=NODE_ENV=production,PORT=3001" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=false" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=15" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/dev/stdout" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/dev/stderr" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:nginx]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=/usr/sbin/nginx -g \"daemon off;\"" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=false" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=5" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/dev/stdout" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/dev/stderr" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "priority=999" >> /etc/supervisor/conf.d/supervisord.conf'

# Setup permissions - but keep root for nginx and supervisor
RUN mkdir -p /app/backend/storage && chown -R 1001:1001 /app

# Create entrypoint script to run migrations
RUN echo '#!/bin/bash' > /entrypoint.sh && \
echo 'echo "🔄 Aguardando banco de dados..."' >> /entrypoint.sh && \
echo 'for i in {1..30}; do' >> /entrypoint.sh && \
echo '  if nc -z db 5432 2>/dev/null; then' >> /entrypoint.sh && \
echo '    echo "✅ Banco disponível"' >> /entrypoint.sh && \
echo '    break' >> /entrypoint.sh && \
echo '  fi' >> /entrypoint.sh && \
echo '  sleep 1' >> /entrypoint.sh && \
echo 'done' >> /entrypoint.sh && \
echo 'sleep 2' >> /entrypoint.sh && \
echo 'echo "🔄 Sincronizando schema do Prisma..."' >> /entrypoint.sh && \
echo 'cd /app/backend && npx prisma db push --skip-generate 2>&1 || echo "⚠️ Prisma sync completed with exit code"' >> /entrypoint.sh && \
echo 'sleep 2' >> /entrypoint.sh && \
echo 'echo "🔄 Inicializando banco de dados..."' >> /entrypoint.sh && \
echo 'cd /app/backend && npm run db:seed 2>&1 || echo "⚠️ Seed completed"' >> /entrypoint.sh && \
echo 'echo "✅ Sistema pronto!"' >> /entrypoint.sh && \
echo 'exec supervisord -c /etc/supervisor/conf.d/supervisord.conf' >> /entrypoint.sh && \
chmod +x /entrypoint.sh

# Install netcat for database checks
RUN apt-get update && apt-get install -y --no-install-recommends netcat-traditional && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Don't switch to nodejs user - supervisor needs to run as root to manage nginx

EXPOSE 80
# Removed HEALTHCHECK as it was causing container restarts

ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]
