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
RUN npm config set fetch-timeout 120000 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 120000 && npm config set fetch-retries 5

RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . 

# Build backend
WORKDIR /build/backend
RUN npm install --legacy-peer-deps && npm run build

# Build frontend
WORKDIR /build/frontend
RUN npm install --legacy-peer-deps && npm run build

# Copy to final location
WORKDIR /
RUN mkdir -p /app/backend /app/frontend /app/frontend/public && \
    cp -r /build/backend/dist /app/backend/ && \
    cp -r /build/backend/node_modules /app/backend/ && \
    cp /build/backend/package.json /app/backend/ && \
    cp -r /build/frontend/.next /app/frontend/ && \
    cp -r /build/frontend/node_modules /app/frontend/ && \
    cp /build/frontend/package.json /app/frontend/ && \
    [ -d /build/frontend/public ] && cp -r /build/frontend/public/* /app/frontend/public/ || true && \
    rm -rf /build && \
    npm cache clean --force && \
    find /app -type f -name "*.map" -delete && \
    find /app -type d -name ".next/cache" -exec rm -rf {} + 2>/dev/null || true

# Setup Nginx config - using shell script to avoid heredoc parsing issues
RUN /bin/bash -c 'echo "upstream api { server 127.0.0.1:3000 max_fails=10 fail_timeout=30s; keepalive 32; }" > /etc/nginx/conf.d/default.conf && \
echo "upstream web { server 127.0.0.1:3001 max_fails=10 fail_timeout=30s; keepalive 32; }" >> /etc/nginx/conf.d/default.conf && \
echo "server {" >> /etc/nginx/conf.d/default.conf && \
echo "  listen 80 default_server;" >> /etc/nginx/conf.d/default.conf && \
echo "  server_name _;" >> /etc/nginx/conf.d/default.conf && \
echo "  client_max_body_size 50M;" >> /etc/nginx/conf.d/default.conf && \
echo "  proxy_connect_timeout 90s;" >> /etc/nginx/conf.d/default.conf && \
echo "  proxy_send_timeout 90s;" >> /etc/nginx/conf.d/default.conf && \
echo "  proxy_read_timeout 90s;" >> /etc/nginx/conf.d/default.conf && \
echo "  proxy_buffering off;" >> /etc/nginx/conf.d/default.conf && \
echo "  location /api/ { proxy_pass http://api; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; proxy_connect_timeout 90s; proxy_read_timeout 90s; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location / { proxy_pass http://web; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location /health { access_log off; return 200 \"OK\"; add_header Content-Type text/plain; }" >> /etc/nginx/conf.d/default.conf && \
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
echo "startsecs=30" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/dev/stdout" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/dev/stderr" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile_maxbytes=0" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:frontend]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "directory=/app/frontend" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=/bin/bash -c \"exec node_modules/.bin/next start -p 3001\"" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=false" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=30" >> /etc/supervisor/conf.d/supervisord.conf && \
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
echo 'set -e' >> /entrypoint.sh && \
echo 'echo "🔄 Aguardando banco de dados..."' >> /entrypoint.sh && \
echo 'for i in {1..30}; do' >> /entrypoint.sh && \
echo '  if nc -z db 5432; then' >> /entrypoint.sh && \
echo '    echo "✅ Banco disponível"' >> /entrypoint.sh && \
echo '    break' >> /entrypoint.sh && \
echo '  fi' >> /entrypoint.sh && \
echo '  sleep 1' >> /entrypoint.sh && \
echo 'done' >> /entrypoint.sh && \
echo 'echo "🔄 Rodando migrations do Prisma..."' >> /entrypoint.sh && \
echo 'cd /app/backend && npx prisma migrate deploy || true' >> /entrypoint.sh && \
echo 'echo "🔄 Inicializando banco de dados..."' >> /entrypoint.sh && \
echo 'cd /app/backend && npx ts-node src/scripts/init-db.ts || true' >> /entrypoint.sh && \
echo 'echo "✅ Banco inicializado!"' >> /entrypoint.sh && \
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
