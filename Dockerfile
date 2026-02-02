# ============================================================
# WHATSAPP CRM - COMPLETE SELF-CONTAINED BUILD
# NO LOCAL COPY - PURE GIT CLONE
# ============================================================

FROM node:20-alpine
RUN apk add --no-cache git nginx supervisor curl dumb-init bash
RUN mkdir -p /app /var/log/supervisor /etc/nginx/conf.d /etc/supervisor/conf.d
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nodejs

WORKDIR /build

# Clone, build backend, move to final location
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git . && \
    cd backend && \
    npm install --legacy-peer-deps && \
    npm run build && \
    mkdir -p /app/backend && \
    cp -r dist /app/backend/ && \
    cp -r node_modules /app/backend/ && \
    cp package.json /app/backend/

# Build frontend and move to final location
WORKDIR /build/frontend
RUN npm install --legacy-peer-deps && \
    npm run build && \
    mkdir -p /app/frontend && \
    cp -r .next /app/frontend/ && \
    cp -r node_modules /app/frontend/ && \
    cp -r public /app/frontend/ && \
    cp package.json /app/frontend/

# Cleanup build directory
RUN rm -rf /build

# Setup Nginx
RUN printf "upstream api { server 127.0.0.1:3000; }\nupstream web { server 127.0.0.1:3001; }\nserver {\n  listen 80;\n  location /api/ { proxy_pass http://api; proxy_set_header Host \$host; }\n  location / { proxy_pass http://web; proxy_set_header Host \$host; }\n  location /health { return 200 OK; }\n}\n" > /etc/nginx/conf.d/default.conf

# Setup Supervisor
RUN printf "[supervisord]\nnodaemon=true\nlogfile=/var/log/supervisor/supervisord.log\n\n[program:backend]\ndirectory=/app/backend\ncommand=node dist/main.js\nautorestart=true\nstdout_logfile=/var/log/supervisor/backend.log\nstderr_logfile=/var/log/supervisor/backend.err\n\n[program:frontend]\ndirectory=/app/frontend\ncommand=npm start\nautorestart=true\nstdout_logfile=/var/log/supervisor/frontend.log\nstderr_logfile=/var/log/supervisor/frontend.err\n\n[program:nginx]\ncommand=/usr/sbin/nginx -g \"daemon off;\"\nautorestart=true\nstdout_logfile=/var/log/supervisor/nginx.log\nstderr_logfile=/var/log/supervisor/nginx.err\n" > /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /app/backend/storage && chown -R nodejs:nodejs /app

WORKDIR /app
USER nodejs

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
