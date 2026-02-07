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

# Setup Nginx config
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
upstream api {
  server 127.0.0.1:3000;
}

upstream web {
  server 127.0.0.1:3001;
}

server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    proxy_pass http://web;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /health {
    access_log off;
    return 200 "OK";
    add_header Content-Type text/plain;
  }
}
EOF

# Setup Supervisor config
RUN cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log

[program:backend]
directory=/app/backend
command=node dist/main.js
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/backend.log
stdout_logfile=/var/log/supervisor/backend.log

[program:frontend]
directory=/app/frontend
command=/bin/bash -c "exec node_modules/.bin/next start -p 3001"
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/frontend.log
stdout_logfile=/var/log/supervisor/frontend.log

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/nginx.log
stdout_logfile=/var/log/supervisor/nginx.log
priority=999
EOF

# Setup permissions - but keep root for nginx and supervisor
RUN mkdir -p /app/backend/storage && chown -R 1001:1001 /app

WORKDIR /app
# Don't switch to nodejs user - supervisor needs to run as root to manage nginx

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
