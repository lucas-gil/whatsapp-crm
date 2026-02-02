# WhatsApp CRM Production Dockerfile
# v2.0.1 - Feb 02 2026 - Fresh Build

FROM node:20-alpine as stage_backend

RUN apk add --no-cache git
WORKDIR /build
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . 
WORKDIR /build/backend
RUN npm install --legacy-peer-deps && npm run build

FROM node:20-alpine as stage_frontend

RUN apk add --no-cache git
WORKDIR /build
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git .
WORKDIR /build/frontend
RUN npm install --legacy-peer-deps && npm run build

FROM node:20-alpine

RUN apk add --no-cache nginx supervisor curl dumb-init bash
RUN mkdir -p /app /var/log/supervisor
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nodejs

WORKDIR /app

COPY --from=stage_backend /build/backend/dist ./backend/dist
COPY --from=stage_backend /build/backend/node_modules ./backend/node_modules
COPY --from=stage_backend /build/backend/package.json ./backend/package.json

COPY --from=stage_frontend /build/frontend/.next ./frontend/.next
COPY --from=stage_frontend /build/frontend/node_modules ./frontend/node_modules
COPY --from=stage_frontend /build/frontend/public ./frontend/public
COPY --from=stage_frontend /build/frontend/package.json ./frontend/package.json

RUN mkdir -p /app/backend/storage /app/backend/sessions && chown -R nodejs:nodejs /app

RUN rm -f /etc/nginx/conf.d/default.conf && cat > /etc/nginx/conf.d/default.conf << 'NGINX'
upstream backend {
  server 127.0.0.1:3000;
}
upstream frontend {
  server 127.0.0.1:3001;
}
server {
  listen 80;
  client_max_body_size 100M;
  location /health {
    return 200 "OK";
    add_header Content-Type text/plain;
  }
  location /api/ {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  location / {
    proxy_pass http://frontend;
    proxy_set_header Host $host;
  }
}
NGINX

RUN mkdir -p /etc/supervisor/conf.d && cat > /etc/supervisor/conf.d/supervisord.conf << 'SUPER'
[supervisord]
nodaemon=true

[program:backend]
directory=/app/backend
command=node dist/main.js
autorestart=true
stdout_logfile=/var/log/supervisor/backend.log
stderr_logfile=/var/log/supervisor/backend.err

[program:frontend]
directory=/app/frontend
command=npm start
autorestart=true
stdout_logfile=/var/log/supervisor/frontend.log
stderr_logfile=/var/log/supervisor/frontend.err

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autorestart=true
stdout_logfile=/var/log/supervisor/nginx.log
stderr_logfile=/var/log/supervisor/nginx.err
SUPER

USER nodejs
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
