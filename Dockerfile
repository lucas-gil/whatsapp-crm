# ============================================================
# WHATSAPP CRM - COMPLETE SELF-CONTAINED BUILD
# NO LOCAL COPY - PURE GIT CLONE
# ============================================================

FROM node:20
RUN apt-get update && apt-get install -y --no-install-recommends git nginx supervisor curl dumb-init bash && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app /var/log/supervisor /etc/nginx/conf.d /etc/supervisor/conf.d
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nodejs

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

# Setup Nginx
RUN printf "upstream api { server 127.0.0.1:3000; }\nupstream web { server 127.0.0.1:3001; }\nserver {\n  listen 80;\n  location /api/ { proxy_pass http://api; proxy_set_header Host \$host; }\n  location / { proxy_pass http://web; proxy_set_header Host \$host; }\n  location /health { return 200 OK; }\n}\n" > /etc/nginx/conf.d/default.conf

# Setup Supervisor
RUN printf "[supervisord]\nnodaemon=true\n[program:backend]\ndirectory=/app/backend\ncommand=node dist/main.js\nautorestart=true\n[program:frontend]\ndirectory=/app/frontend\ncommand=npm start\nautorestart=true\n[program:nginx]\ncommand=/usr/sbin/nginx -g \"daemon off;\"\nautorestart=true\n" > /etc/supervisor/conf.d/supervisord.conf

# Setup permissions
RUN mkdir -p /app/backend/storage && chown -R nodejs:nodejs /app

WORKDIR /app
USER nodejs

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
