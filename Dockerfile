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

# Create NGINX config
RUN mkdir -p /etc/nginx/conf.d && \
    echo "upstream backend { server 127.0.0.1:3000; } \
upstream frontend { server 127.0.0.1:3001; } \
server { \
  listen 80; \
  client_max_body_size 100M; \
  location /health { return 200 \"OK\"; add_header Content-Type text/plain; } \
  location /api/ { proxy_pass http://backend; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; } \
  location / { proxy_pass http://frontend; proxy_set_header Host \$host; } \
}" > /etc/nginx/conf.d/default.conf

# Create Supervisor config
RUN mkdir -p /etc/supervisor/conf.d && \
    echo "[supervisord] \n nodaemon=true \n \
[program:backend] \n directory=/app/backend \n command=node dist/main.js \n autorestart=true \n \
[program:frontend] \n directory=/app/frontend \n command=npm start \n autorestart=true \n \
[program:nginx] \n command=/usr/sbin/nginx -g \"daemon off;\" \n autorestart=true" > /etc/supervisor/conf.d/supervisord.conf

USER nodejs
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
