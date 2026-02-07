# ============================================================
# WHATSAPP CRM - COMPLETE SELF-CONTAINED BUILD
# NO LOCAL COPY - PURE GIT CLONE
# ============================================================

FROM node:20
RUN apt-get update && apt-get install -y --no-install-recommends git nginx supervisor curl dumb-init bash && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app /var/log/supervisor /etc/nginx/conf.d /etc/supervisor/conf.d
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /usr/sbin/nologin nodejs

WORKDIR /build

# Clone repository
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
    rm -rf /build

# Setup Nginx config - using shell script to avoid heredoc parsing issues
RUN /bin/bash -c 'echo "upstream api { server 127.0.0.1:3000; }" > /etc/nginx/conf.d/default.conf && \
echo "upstream web { server 127.0.0.1:3001; }" >> /etc/nginx/conf.d/default.conf && \
echo "server {" >> /etc/nginx/conf.d/default.conf && \
echo "  listen 80;" >> /etc/nginx/conf.d/default.conf && \
echo "  server_name _;" >> /etc/nginx/conf.d/default.conf && \
echo "  location /api/ { proxy_pass http://api; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location / { proxy_pass http://web; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }" >> /etc/nginx/conf.d/default.conf && \
echo "  location /health { access_log off; return 200 \"OK\"; add_header Content-Type text/plain; }" >> /etc/nginx/conf.d/default.conf && \
echo "}" >> /etc/nginx/conf.d/default.conf'

# Setup Supervisor config
RUN /bin/bash -c 'echo "[supervisord]" > /etc/supervisor/conf.d/supervisord.conf && \
echo "nodaemon=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "user=root" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "logfile=/var/log/supervisor/supervisord.log" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:backend]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "directory=/app/backend" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=node dist/main.js" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=10" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/var/log/supervisor/backend.err" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/var/log/supervisor/backend.log" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:frontend]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "directory=/app/frontend" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=/bin/bash -c \"exec node_modules/.bin/next start -p 3001\"" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "startsecs=10" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/var/log/supervisor/frontend.err" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/var/log/supervisor/frontend.log" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "[program:nginx]" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "command=/usr/sbin/nginx -g \"daemon off;\"" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "autorestart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stderr_logfile=/var/log/supervisor/nginx.err" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "stdout_logfile=/var/log/supervisor/nginx.log" >> /etc/supervisor/conf.d/supervisord.conf && \
echo "priority=999" >> /etc/supervisor/conf.d/supervisord.conf'

# Setup permissions - but keep root for nginx and supervisor
RUN mkdir -p /app/backend/storage && chown -R 1001:1001 /app

WORKDIR /app
# Don't switch to nodejs user - supervisor needs to run as root to manage nginx

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
