FROM node:20-alpine AS builder

WORKDIR /app

# Instalar git
RUN apk add --no-cache git

# Clone do repositório
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git .

WORKDIR /app/frontend

# Copiar package files
COPY package*.json ./

# Limpar cache e instalar dependências
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --force

# Copiar código-fonte
COPY . .

# Build do Next.js
RUN npm run build

# Verificar se build foi bem-sucedido
RUN test -d .next || (echo "Build failed: .next directory not found" && exit 1)

FROM node:20-alpine

WORKDIR /app/frontend

# Instalar dumb-init
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar dependências de produção
COPY --from=builder --chown=nodejs:nodejs /app/frontend/node_modules ./node_modules

# Copiar package.json
COPY --from=builder --chown=nodejs:nodejs /app/frontend/package.json ./package.json

# Copiar .next (build compilado)
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next ./.next

# Copiar public
COPY --from=builder --chown=nodejs:nodejs /app/frontend/public ./public

# Copiar config files
COPY --from=builder --chown=nodejs:nodejs /app/frontend/next.config.js ./next.config.js
COPY --from=builder --chown=nodejs:nodejs /app/frontend/tsconfig.json ./tsconfig.json

# Trocar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Usar dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Iniciar Next.js em produção
CMD ["npm", "start"]
