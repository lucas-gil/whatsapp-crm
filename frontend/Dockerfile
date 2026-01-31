FROM node:20-alpine AS builder

WORKDIR /app

# Instalar git
RUN apk add --no-cache git

# Clone do repositório
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git .

WORKDIR /app/frontend

COPY package*.json ./

# Limpar cache e instalar com --force
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --force

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app/frontend

COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/frontend/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/frontend/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/frontend/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/frontend/next.config.js ./next.config.js

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start", "-p", "3000"]
