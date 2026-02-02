# ============================================================
# WHATSAPP CRM PRODUCTION
# Built from GitHub - Self-contained
# ============================================================

FROM node:20-alpine AS stage_build_backend_only
RUN apk add --no-cache git
WORKDIR /workspace
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . && cd backend && npm install --legacy-peer-deps && npm run build

FROM node:20-alpine AS stage_build_frontend_only
RUN apk add --no-cache git
WORKDIR /workspace
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . && cd frontend && npm install --legacy-peer-deps && npm run build

FROM node:20-alpine AS runtime_final
RUN apk add --no-cache nginx supervisor curl dumb-init
RUN mkdir -p /var/log/supervisor /app /etc/nginx/conf.d /etc/supervisor/conf.d
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nodejs

WORKDIR /app

COPY --from=stage_build_backend_only /workspace/backend/dist ./backend/dist
COPY --from=stage_build_backend_only /workspace/backend/node_modules ./backend/node_modules
COPY --from=stage_build_backend_only /workspace/backend/package.json ./backend/

COPY --from=stage_build_frontend_only /workspace/frontend/.next ./frontend/.next
COPY --from=stage_build_frontend_only /workspace/frontend/node_modules ./frontend/node_modules
COPY --from=stage_build_frontend_only /workspace/frontend/public ./frontend/public
COPY --from=stage_build_frontend_only /workspace/frontend/package.json ./frontend/

RUN mkdir -p /app/backend/storage /app/backend/sessions && chown -R nodejs:nodejs /app

RUN printf "upstream api { server 127.0.0.1:3000; }\nupstream web { server 127.0.0.1:3001; }\nserver {\n  listen 80;\n  location /api/ { proxy_pass http://api; proxy_set_header Host \$host; }\n  location / { proxy_pass http://web; proxy_set_header Host \$host; }\n  location /health { return 200 OK; }\n}\n" > /etc/nginx/conf.d/default.conf

RUN printf "[supervisord]\nnodaemon=true\nlogfile=/var/log/supervisor/supervisord.log\n\n[program:backend]\ndirectory=/app/backend\ncommand=node dist/main.js\nautorestart=true\nstdout_logfile=/var/log/supervisor/backend.log\nstderr_logfile=/var/log/supervisor/backend.err\n\n[program:frontend]\ndirectory=/app/frontend\ncommand=npm start\nautorestart=true\nstdout_logfile=/var/log/supervisor/frontend.log\nstderr_logfile=/var/log/supervisor/frontend.err\n\n[program:nginx]\ncommand=/usr/sbin/nginx -g \"daemon off;\"\nautorestart=true\nstdout_logfile=/var/log/supervisor/nginx.log\nstderr_logfile=/var/log/supervisor/nginx.err\n" > /etc/supervisor/conf.d/supervisord.conf

USER nodejs
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
