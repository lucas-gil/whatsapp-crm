# WhatsApp CRM - Production Ready
# Version: 3.0.0 - Feb 02 2026 12:00 UTC
# All-in-One: Backend + Frontend + Nginx

FROM node:20-alpine as build_backend
RUN apk add --no-cache git
WORKDIR /tmp
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git app && cd app/backend && npm install --legacy-peer-deps && npm run build

FROM node:20-alpine as build_frontend  
RUN apk add --no-cache git
WORKDIR /tmp
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git app && cd app/frontend && npm install --legacy-peer-deps && npm run build

FROM node:20-alpine as production
RUN apk add --no-cache nginx supervisor curl dumb-init
RUN mkdir -p /var/log/supervisor /app && addgroup -g 1001 nodejs && adduser -S -u 1001 nodejs

WORKDIR /app

COPY --from=build_backend /tmp/app/backend/dist ./backend/dist
COPY --from=build_backend /tmp/app/backend/node_modules ./backend/node_modules
COPY --from=build_backend /tmp/app/backend/package.json ./backend/

COPY --from=build_frontend /tmp/app/frontend/.next ./frontend/.next
COPY --from=build_frontend /tmp/app/frontend/node_modules ./frontend/node_modules
COPY --from=build_frontend /tmp/app/frontend/public ./frontend/public
COPY --from=build_frontend /tmp/app/frontend/package.json ./frontend/

RUN mkdir -p /app/backend/storage && chown -R nodejs:nodejs /app

RUN mkdir -p /etc/nginx/conf.d && echo 'upstream api{server 127.0.0.1:3000;}upstream web{server 127.0.0.1:3001;}server{listen 80;location /api/{proxy_pass http://api;}location /{proxy_pass http://web;}location /health{return 200 OK;}}' > /etc/nginx/conf.d/default.conf

RUN mkdir -p /etc/supervisor/conf.d && echo '[supervisord]
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
autorestart=true' > /etc/supervisor/conf.d/supervisord.conf

USER nodejs
EXPOSE 80
HEALTHCHECK --interval=30s CMD curl http://localhost/health 2>/dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
