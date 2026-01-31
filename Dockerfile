FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY . .

WORKDIR /app/backend

# Instalar dependências
RUN npm install --legacy-peer-deps

# Instalar ts-node para rodar TypeScript direto
RUN npm install -g ts-node typescript

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/backend/storage /app/backend/sessions && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
# Roda o TypeScript direto sem precisar fazer build
CMD ["ts-node", "src/main.ts"]
