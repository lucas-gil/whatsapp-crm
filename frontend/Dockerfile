FROM node:20-alpine AS builder

WORKDIR /app

# Instalar git
RUN apk add --no-cache git

# Clone do repositório
RUN git clone https://github.com/lucas-gil/whatsapp-crm.git .

WORKDIR /app/frontend

# Limpar cache e instalar dependências (sem copiar - já estão no clone)
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --force

# Fazer build
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

# Copiar apenas o necessário do builder
COPY --from=builder --chown=nodejs:nodejs /app/frontend/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/frontend/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/frontend/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.env.production ./.env.production

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
