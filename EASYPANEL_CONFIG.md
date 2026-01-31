# Configuração Completa - EasyPanel

## 📋 SERVIÇO 1: FRONTEND

### Informações Básicas
- **Nome:** `frontend-whatsapp` (ou outro nome que queira)
- **Origem:** GitHub
- **Repositório:** `https://github.com/lucas-gil/whatsapp-crm`
- **Branch:** `main`

### Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY . .

RUN npm install --legacy-peer-deps

RUN npm run build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start"]
```

### Variáveis de Ambiente
```
NEXT_PUBLIC_API_URL=http://backend-whatsapp:3000
NODE_ENV=production
```

### Portas
- **Interna:** 3000
- **Externa:** 3001 (ou qualquer porta que queira)

### Domínio
- `seu-dominio.com` (configure aqui)

---

## 📋 SERVIÇO 2: BACKEND

### Informações Básicas
- **Nome:** `backend-whatsapp` (exatamente este nome!)
- **Origem:** GitHub
- **Repositório:** `https://github.com/lucas-gil/whatsapp-crm`
- **Branch:** `main`

### Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY . .

RUN npm install --legacy-peer-deps

RUN npm run build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
```

### Variáveis de Ambiente
```
NODE_ENV=production
DATABASE_URL=postgresql://whatsapp_user:sua_senha@postgres:5432/whatsapp_crm
REDIS_URL=redis://redis:6379
JWT_SECRET=gere-uma-chave-secreta-com-32-caracteres
PORT=3000
CORS_ORIGIN=http://frontend-whatsapp:3000
WHATSAPP_PROVIDER=web-qr
STORAGE_PROVIDER=local
STORAGE_PATH=./storage
```

### Portas
- **Interna:** 3000
- **Externa:** 3000 (ou outra)

### Domínio
- `api.seu-dominio.com` (configure aqui)

---

## 🗄️ SERVIÇO 3: POSTGRESQL (se não tiver)

### Informações
- **Nome:** `postgres`
- **Imagem:** `postgres:16-alpine`

### Variáveis de Ambiente
```
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=sua_senha_segura_aqui
POSTGRES_DB=whatsapp_crm
```

### Volumes
- `/var/lib/postgresql/data` → `postgres_data`

### Porta
- 5432

---

## 🔄 SERVIÇO 4: REDIS (se não tiver)

### Informações
- **Nome:** `redis`
- **Imagem:** `redis:7-alpine`

### Comando
```
redis-server --appendonly yes
```

### Volumes
- `/data` → `redis_data`

### Porta
- 6379

---

## ✅ PASSO A PASSO

1. **Crie PostgreSQL primeiro** (Ambiente)
2. **Crie Redis** (Ambiente)
3. **Crie Backend** (depende de PostgreSQL + Redis)
4. **Crie Frontend** (depende de Backend)

---

## 🔐 VALORES PARA COPIAR/COLAR

### JWT_SECRET (gere um novo):
```
abcdef1234567890abcdef1234567890
```
(Ou rode em um terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### POSTGRES_PASSWORD:
```
SuaSenhaSegura123!@#
```
(Mude para algo seguro)

---

## 🧪 Teste Após Deploy

1. Acesse `http://seu-dominio.com` (Frontend)
2. Acesse `http://api.seu-dominio.com/health` (Backend)
3. Verifique os logs se tiver erro

---

**Data:** 31 de Janeiro de 2026
