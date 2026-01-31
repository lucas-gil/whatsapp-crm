FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY . .

# Entrar na pasta backend E fazer build
WORKDIR /app/backend

RUN npm install --legacy-peer-deps 2>&1 || true

RUN npm run build 2>&1 || echo "Build falhou"

RUN ls -la /app/backend/dist || echo "dist não existe"

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/backend/storage /app/backend/sessions && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
