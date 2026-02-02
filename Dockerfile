# ============================================
# STAGE 1: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /build

# Clone do repositório completo
RUN apk add --no-cache git && \
    git clone https://github.com/lucas-gil/whatsapp-crm.git . && \
    git fetch --all && \
    git checkout main

WORKDIR /build/backend

# Instalar dependências
RUN npm install --legacy-peer-deps

# Build do backend
RUN npm run build

# ============================================
# STAGE 2: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Clone do repositório completo
RUN apk add --no-cache git && \
    git clone https://github.com/lucas-gil/whatsapp-crm.git . && \
    git fetch --all && \
    git checkout main

WORKDIR /build/frontend

# Instalar dependências
RUN npm install --legacy-peer-deps

# Build do frontend
RUN npm run build

# ============================================
# STAGE 3: Runtime
# ============================================
FROM node:20-alpine

# Instalar Nginx, Supervisor e ferramentas
RUN apk add --no-cache nginx supervisor curl dumb-init bash

# Criar diretórios e usuário
RUN mkdir -p /var/log/supervisor /app/backend /app/frontend /var/run/nginx && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/backend/storage /app/backend/sessions

WORKDIR /app

# ============================================
# Copiar Backend
# ============================================
COPY --from=backend-builder /build/backend/dist ./backend/dist
COPY --from=backend-builder /build/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /build/backend/package.json ./backend/package.json
COPY --from=backend-builder /build/prisma ./prisma

# ============================================
# Copiar Frontend
# ============================================
COPY --from=frontend-builder /build/frontend/.next ./frontend/.next
COPY --from=frontend-builder /build/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /build/frontend/public ./frontend/public
COPY --from=frontend-builder /build/frontend/package.json ./frontend/package.json

# ============================================
# Nginx Config
# ============================================
RUN mkdir -p /etc/nginx/conf.d && rm -f /etc/nginx/conf.d/default.conf

RUN cat > /etc/nginx/conf.d/app.conf <<'NGINX_EOF'
upstream backend {
    server 127.0.0.1:3000;
}

upstream frontend {
    server 127.0.0.1:3001;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 100M;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # API routes to backend
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Everything else to frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF

# ============================================
# Supervisor Config
# ============================================
RUN cat > /etc/supervisor/conf.d/supervisord.conf <<'SUPERVISOR_EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:backend]
directory=/app/backend
command=node dist/main.js
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/backend.out.log
stderr_logfile=/var/log/supervisor/backend.err.log
environment=NODE_ENV=production,PORT=3000

[program:frontend]
directory=/app/frontend
command=npm start
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/frontend.out.log
stderr_logfile=/var/log/supervisor/frontend.err.log
environment=NODE_ENV=production

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/nginx.out.log
stderr_logfile=/var/log/supervisor/nginx.err.log
SUPERVISOR_EOF

# ============================================
# Environment Variables
# ============================================
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=/api
ENV DATABASE_URL=postgresql://whatsapp_user:whatsapp_password@postgres:5432/whatsapp_crm
ENV REDIS_URL=redis://redis:6379

RUN chown -R nodejs:nodejs /app

USER nodejs

# ============================================
# Expose & Health Check
# ============================================
EXPOSE 80 3000 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# ============================================
# Start Services
# ============================================
ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
