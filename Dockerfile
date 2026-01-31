# ==========================
# STAGE 1: Builder
# ==========================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar git para clone
RUN apk add --no-cache git

# Clone do repositório
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git .

WORKDIR /app/backend

# Limpar cache de npm
RUN npm cache clean --force

# Instalar dependências com --force para resolver conflitos
RUN npm install --legacy-peer-deps --force

# Build do aplicativo
RUN npm run build

# ==========================
# STAGE 2: Runtime
# ==========================
FROM node:20-alpine

WORKDIR /app

# Instalar dumb-init para signal handling
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app/backend

# Copiar package files
COPY --from=builder /app/backend/package*.json ./

# Limpar cache e instalar dependências de produção
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --omit=dev --force

# Copiar build compilado
COPY --from=builder /app/backend/dist ./dist

# Copiar prisma
COPY --from=builder /app/backend/prisma ./prisma

# Criar diretórios necessários
RUN mkdir -p /app/backend/storage /app/backend/sessions && \
    chown -R nodejs:nodejs /app

# Usar usuário não-root
USER nodejs

EXPOSE 3000

# Usar dumb-init para sinais corretos
ENTRYPOINT ["dumb-init", "--"]

# Executar aplicativo
CMD ["node", "dist/main.js"]
