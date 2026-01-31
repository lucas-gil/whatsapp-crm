# 🚀 DEPLOYMENT

Guia de deploy para EasyPanel, Hostinger e outros provedores.

## 🎯 Pré-requisitos

- [ ] Domínio apontando para o servidor
- [ ] SSH acesso ao servidor
- [ ] Docker + Docker Compose instalados
- [ ] 2GB RAM mínimo, 10GB disco
- [ ] Certificado SSL (auto com EasyPanel)

## 📦 Preparar Repositório

### 1. Criar Repositório Privado

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:seu-usuario/whatsapp-crm.git
git push -u origin main
```

### 2. Gerar Chave SSH (para deployment automático)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/whatsapp-crm-deploy -C "whatsapp-crm"

# Adicionar ao GitHub
cat ~/.ssh/whatsapp-crm-deploy.pub
# Settings → Deploy Keys → Add deploy key
```

## 🐳 Deploy no EasyPanel

### 1. Preparar Imagens Docker

```bash
# Build localmente
docker build -t seu-usuario/whatsapp-crm-backend:v1.0.0 ./backend
docker build -t seu-usuario/whatsapp-crm-frontend:v1.0.0 ./frontend

# Push para DockerHub
docker push seu-usuario/whatsapp-crm-backend:v1.0.0
docker push seu-usuario/whatsapp-crm-frontend:v1.0.0
```

### 2. No EasyPanel Dashboard

1. **Criar novo projeto**
   - Nome: WhatsApp CRM
   - Stack: Docker Compose

2. **Upload docker-compose.yml**
   - Copiar conteúdo do arquivo raiz
   - **Modificar**:
     ```yaml
     backend:
       image: seu-usuario/whatsapp-crm-backend:v1.0.0
     frontend:
       image: seu-usuario/whatsapp-crm-frontend:v1.0.0
     
     # Remover build (usar image do registry)
     # Adicionar restart policy
     restart_policy: unless-stopped
     ```

3. **Configurar Variáveis de Ambiente**

   **Backend**:
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://user:senha@postgres:5432/whatsapp_crm
   REDIS_URL=redis://redis:6379
   JWT_SECRET=<gerar com: openssl rand -hex 32>
   CORS_ORIGIN=https://seu-dominio.com
   WHATSAPP_PROVIDER=web-qr
   STORAGE_PROVIDER=local
   STORAGE_PATH=/app/storage
   ```

   **Frontend**:
   ```
   NEXT_PUBLIC_API_URL=https://seu-dominio.com
   NODE_ENV=production
   ```

4. **Alocação de Porta**
   - Backend: Porta 3000 (interno)
   - Frontend: Porta 3001 (interno)

5. **Deploy**
   - Clicar "Deploy"
   - Aguardar build e start (3-5 min)

### 3. Configurar Reverse Proxy (EasyPanel)

**Para frontend (seu-dominio.com)**:
- Type: Reverse Proxy
- Target: http://frontend:3000
- SSL: Automático

**Para API (api.seu-dominio.com)**:
- Type: Reverse Proxy
- Target: http://backend:3000
- SSL: Automático

### 4. Volumes Persistentes

```bash
# No EasyPanel, mapear volumes:
/app/storage → volume: whatsapp_storage
/var/lib/postgresql/data → volume: postgres_data
/data → volume: redis_data
```

## 🔐 Configurações de Segurança

### 1. Firewall

```bash
# Permitir apenas portas necessárias
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw deny 3000   # Backend (apenas interno)
ufw deny 5432   # PostgreSQL (apenas interno)
```

### 2. SSL/TLS

```bash
# EasyPanel configura automaticamente com Let's Encrypt
# Renovação automática a cada 90 dias

# Verificar certificado
openssl s_client -connect seu-dominio.com:443
```

### 3. Database Backup

```bash
# Automático (recomendado diário)
# Adicionar cron:

0 2 * * * docker-compose exec postgres \
  pg_dump -U whatsapp_user whatsapp_crm > \
  /backups/db_$(date +\%Y\%m\%d).sql

# Comprimir
0 3 * * * gzip /backups/db_*.sql

# Upload para storage externo
0 4 * * * aws s3 sync /backups/ s3://seu-bucket/backups/
```

## 🔄 Atualizar em Produção

### 1. Novo Release (v1.0.1)

```bash
# Build novas imagens
docker build -t seu-usuario/whatsapp-crm-backend:v1.0.1 ./backend
docker build -t seu-usuario/whatsapp-crm-frontend:v1.0.1 ./frontend

# Push
docker push seu-usuario/whatsapp-crm-backend:v1.0.1
docker push seu-usuario/whatsapp-crm-frontend:v1.0.1
```

### 2. No Servidor

```bash
# SSH no servidor
ssh deploy@seu-servidor

# Parar serviços
docker-compose down

# Atualizar docker-compose.yml com novas tags
nano docker-compose.yml
# Editar: image: seu-usuario/whatsapp-crm-backend:v1.0.1

# Reinciar
docker-compose up -d

# Verificar logs
docker-compose logs -f backend
```

### 3. Migrations (se houver)

```bash
# Se houver mudanças no schema Prisma
docker-compose exec backend npm run db:migrate
```

## 📊 Monitoramento

### 1. Health Checks

```bash
# Backend
curl https://seu-dominio.com/health

# Frontend
curl https://seu-dominio.com/  # esperar 200
```

### 2. Logs

```bash
# Ver em tempo real
docker-compose logs -f

# Apenas backend
docker-compose logs -f backend

# Últimas 100 linhas
docker-compose logs --tail 100 backend
```

### 3. Recursos

```bash
# CPU, Memória, Disco
docker stats

# Disco do servidor
df -h

# Memória
free -h
```

### 4. Integrar Monitoramento (opcional)

**Sentry** (erro tracking):
```bash
# Instalar pacote
npm install --save @sentry/node

# Configurar em backend/.env
SENTRY_DSN=https://seu-dsn@sentry.io/123456
```

**Datadog/New Relic**:
- Enviar métricas para observabilidade
- Alertas em caso de erro

## 🚨 Troubleshooting de Deploy

### Backend não inicia

```bash
# Ver erro
docker-compose logs backend

# Verificar PostgreSQL
docker-compose logs postgres

# Resetar (cuidado!)
docker-compose down -v
docker-compose up -d
```

### Frontend não carrega

```bash
# Verificar build
docker-compose logs frontend

# Reburilar
docker-compose up -d --force-recreate frontend
```

### Database cheio

```bash
# Ver tamanho
docker-compose exec postgres psql -U whatsapp_user -d whatsapp_crm -c "\l+"

# Limpar audit_logs antigos
docker-compose exec postgres psql -U whatsapp_user -d whatsapp_crm -c \
  "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '6 months';"

# Vacuum
docker-compose exec postgres psql -U whatsapp_user -d whatsapp_crm -c "VACUUM FULL;"
```

### Redis cheio

```bash
# Ver uso
docker-compose exec redis redis-cli INFO memory

# Limpar
docker-compose exec redis redis-cli FLUSHDB

# Resetar filas
docker-compose exec redis redis-cli FLUSHALL
```

## 📈 Escalabilidade

Para crescimento futuro:

### 1. Múltiplos Backends (Load Balancer)

```yaml
# docker-compose-prod.yml
services:
  backend-1:
    build: ./backend
    environment:
      ...
  
  backend-2:
    build: ./backend
    environment:
      ...

  nginx:
    image: nginx:latest
    ports:
      - "3000:3000"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### 2. Database Replicação

```sql
-- PostgreSQL replication (standby)
-- Ativar em servidor separado
```

### 3. Redis Cluster

```bash
# Para filas de grande volume
redis-cluster setup
```

### 4. CDN para Static Assets

```
Frontend → CloudFlare/Akamai → S3/MinIO
```

## 📋 Checklist de Deploy

- [ ] Domínio aponta para servidor
- [ ] SSL certificado ativo
- [ ] Variáveis de ambiente configuradas
- [ ] Database backup configurado
- [ ] Firewall restritivo
- [ ] Logs centralizados
- [ ] Monitoramento ativo
- [ ] Plano de disaster recovery
- [ ] Documentação de runbooks
- [ ] Testes de failover

---

**Próximo passo**: Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para resolver issues comuns.
