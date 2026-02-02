# ============================================
# WhatsApp CRM - Unified Docker Build
# Build Date: 2026-02-02T01:51:00Z
# ============================================

FROM node:20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src

RUN git clone --depth 1 https://github.com/lucas-gil/whatsapp-crm.git .

# Build backend
WORKDIR /src/backend
RUN npm install --legacy-peer-deps && npm run build

# Build frontend
WORKDIR /src/frontend
RUN npm install --legacy-peer-deps && npm run build

# ============================================
# Final Runtime Stage
# ============================================

FROM node:20-alpine

RUN apk add --no-cache nginx supervisor curl dumb-init bash

RUN mkdir -p /app /var/log/supervisor /run/nginx && \
    addgroup -g 1001 nodejs && \
    adduser -S -u 1001 nodejs

WORKDIR /app

# Backend
COPY --from=builder /src/backend/dist ./backend/dist
COPY --from=builder /src/backend/node_modules ./backend/node_modules
COPY --from=builder /src/backend/package.json ./backend/package.json

# Frontend
COPY --from=builder /src/frontend/.next ./frontend/.next
COPY --from=builder /src/frontend/node_modules ./frontend/node_modules
COPY --from=builder /src/frontend/public ./frontend/public
COPY --from=builder /src/frontend/package.json ./frontend/package.json

# Nginx config
RUN rm -f /etc/nginx/conf.d/default.conf && cat > /etc/nginx/conf.d/app.conf << 'EOF'
upstream backend { server 127.0.0.1:3000; }
upstream frontend { server 127.0.0.1:3001; }
server {
    listen 80;
    client_max_body_size 100M;
    location /health { access_log off; return 200 "ok"; }
    location /api/ { proxy_pass http://backend; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location / { proxy_pass http://frontend; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
}
EOF

# Supervisor config
RUN cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true

[program:backend]
directory=/app/backend
command=node dist/main.js
autorestart=true

[program:frontend]
directory=/app/frontend
command=npm start
autorestart=true

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autorestart=true
EOF

RUN mkdir -p /app/backend/storage /app/backend/sessions && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
