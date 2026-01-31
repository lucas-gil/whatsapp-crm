# Guia de Deploy no EasyPanel/Hostinger

## 📋 Comandos Docker para Deploy

### 1. BUILD E PUSH das Imagens

#### Backend
```bash
# No diretório backend/
docker build -t lucas-gil/whatsapp-crm-backend:latest .
docker push lucas-gil/whatsapp-crm-backend:latest
```

#### Frontend
```bash
# No diretório frontend/
docker build -t lucas-gil/whatsapp-crm-frontend:latest .
docker push lucas-gil/whatsapp-crm-frontend:latest
```

---

## 🗄️ Variáveis de Ambiente

### Backend (.env)
```
NODE_ENV=production
DATABASE_URL=postgresql://whatsapp_user:SUA_SENHA_AQUI@postgres-host:5432/whatsapp_crm
REDIS_URL=redis://redis-host:6379
JWT_SECRET=gere-uma-chave-segura-com-32-caracteres-minimo
PORT=3000
CORS_ORIGIN=https://seu-dominio-frontend.com
WHATSAPP_PROVIDER=web-qr
STORAGE_PROVIDER=local
STORAGE_PATH=./storage
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://seu-dominio-backend.com
NODE_ENV=production
```

---

## 🐳 Configuração de Serviços no EasyPanel

### 1. PostgreSQL
**Imagem:** `postgres:16-alpine`

**Variáveis de Ambiente:**
```
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=sua_senha_segura_aqui
POSTGRES_DB=whatsapp_crm
```

**Volumes:**
```
/var/lib/postgresql/data → postgres_data
```

**Porta:** 5432

**Health Check:**
```
Command: ["CMD-SHELL", "pg_isready -U whatsapp_user"]
Interval: 10s
Timeout: 5s
Retries: 5
```

---

### 2. Redis
**Imagem:** `redis:7-alpine`

**Comando:** 
```
redis-server --appendonly yes
```

**Volumes:**
```
/data → redis_data
```

**Porta:** 6379

**Health Check:**
```
Command: ["CMD", "redis-cli", "ping"]
Interval: 10s
Timeout: 5s
Retries: 5
```

---

### 3. Backend (NestJS)
**Imagem:** `lucas-gil/whatsapp-crm-backend:latest`

**Dependências:** PostgreSQL + Redis

**Variáveis de Ambiente:** (veja seção acima)

**Volumes:**
```
/app/storage → backend_storage
/app/sessions → backend_sessions
```

**Porta:** 3000

**Domínio:** `api.seu-dominio.com`

**Health Check:**
```
GET /health
```

---

### 4. Frontend (Next.js)
**Imagem:** `lucas-gil/whatsapp-crm-frontend:latest`

**Dependências:** Backend

**Variáveis de Ambiente:**
```
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com
NODE_ENV=production
```

**Porta:** 3000

**Domínio:** `seu-dominio.com` ou `app.seu-dominio.com`

---

## 🚀 Passos de Deploy

### Passo 1: Preparar repositório Docker Hub
```bash
docker login
# Fazer push das imagens (comandos acima)
```

### Passo 2: No EasyPanel
1. **Create Service → PostgreSQL**
   - Nome: `postgres-whatsapp`
   - Variáveis conforme acima

2. **Create Service → Redis**
   - Nome: `redis-whatsapp`
   - Comando: `redis-server --appendonly yes`

3. **Create Service → Docker**
   - Nome: `backend-whatsapp`
   - Imagem: `lucas-gil/whatsapp-crm-backend:latest`
   - Variáveis de Ambiente: (Backend)
   - Volumes: storage e sessions
   - Domínio: `api.seu-dominio.com`
   - Esperar por: postgres-whatsapp, redis-whatsapp

4. **Create Service → Docker**
   - Nome: `frontend-whatsapp`
   - Imagem: `lucas-gil/whatsapp-crm-frontend:latest`
   - Variáveis de Ambiente: (Frontend)
   - Domínio: `seu-dominio.com`
   - Esperar por: backend-whatsapp

---

## 🔄 Docker Compose Alternativo

Se preferir usar Docker Compose localmente ou no servidor:

```bash
# Executar tudo
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Limpar volumes
docker-compose down -v
```

---

## ✅ Verificação Pós-Deploy

```bash
# Testar Backend
curl https://api.seu-dominio.com/health

# Testar Frontend
curl https://seu-dominio.com

# Ver logs do Backend
docker logs whatsapp-crm-backend

# Ver logs do Frontend
docker logs whatsapp-crm-frontend

# Verificar banco de dados
docker exec whatsapp-crm-postgres psql -U whatsapp_user -d whatsapp_crm -c "SELECT VERSION();"
```

---

## 🔐 Segurança - Alterar Antes de Deploy

1. **JWT_SECRET** - Gere uma chave forte:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **POSTGRES_PASSWORD** - Use senha forte e única

3. **CORS_ORIGIN** - Configure para seus domínios reais

4. **Certificados SSL** - EasyPanel gerencia automaticamente com Let's Encrypt

---

## 🆘 Troubleshooting

**Backend não conecta ao Postgres:**
- Verificar DATABASE_URL
- Esperar Postgres iniciar (health check)

**Frontend mostra erro de conexão:**
- Verificar NEXT_PUBLIC_API_URL
- Verificar CORS_ORIGIN no Backend

**Erros de permissão:**
- Verificar volumes têm permissão 755+
- Usar usuário nodejs (non-root)

---

## 📝 Notas Importantes

- As senhas no `.env.example` SÃO APENAS EXEMPLOS
- Nunca fazer push de `.env` com credenciais reais
- EasyPanel cuida de SSL automaticamente
- Backups do banco: EasyPanel oferece backup automático
- Monitoramento: Use o dashboard do EasyPanel

---

**Último Updated:** 31 de Janeiro de 2026
