FROM node:20-bullseye-slim

WORKDIR /app

# Install dumb-init and OpenSSL runtime required by Prisma engines
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

# generate Prisma client types before building (will produce linux-x64 binaries on Debian)
RUN npx prisma generate || true

RUN npm run build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

RUN mkdir -p /app/storage /app/sessions

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
