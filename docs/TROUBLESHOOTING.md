# 🔧 TROUBLESHOOTING

Soluções para problemas comuns.

## 🔴 Backend não inicia

### Erro: "Cannot find module '@prisma/client'"

```bash
cd backend
npm install
npm run build
docker-compose restart backend
```

### Erro: "ECONNREFUSED 127.0.0.1:5432"

**Causa**: PostgreSQL não disponível

```bash
# Verificar status
docker-compose ps postgres

# Se não está rodando
docker-compose up -d postgres

# Aguardar health check
sleep 10

# Verificar conexão
docker-compose exec postgres psql -U whatsapp_user -d whatsapp_crm -c "SELECT 1"
```

### Erro: "ERROR: relation "user" does not exist"

**Causa**: Migrations não rodaram

```bash
docker-compose exec backend npm run db:migrate

# Se erro persistir, resetar
docker-compose down -v postgres
docker-compose up -d postgres
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed
```

### Erro: JWT_SECRET não configurado

```bash
# Gerar chave segura
openssl rand -hex 32

# Adicionar ao .env
nano backend/.env
JWT_SECRET="sua-chave-aqui"

# Reiniciar
docker-compose restart backend
```

## 🔴 Frontend não carrega

### Erro: "Cannot GET /"

**Causa**: Frontend não iniciou ou não tem rota raiz

```bash
# Verificar status
docker-compose ps frontend

# Ver logs
docker-compose logs frontend

# Rebuildar
docker-compose up -d --force-recreate --build frontend
```

### Erro: "API_URL is undefined"

**Causa**: Variável de ambiente não configurada

```bash
# Adicionar ao frontend/.env
nano frontend/.env
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Rebuild
docker-compose up -d --force-recreate --build frontend
```

## 🔴 Não consegue logar

### Erro: "Chave inválida ou expirada"

1. Verificar se seed foi rodado:
```bash
docker-compose exec backend npm run db:seed
```

2. Copiar corretamente a chave ADMIN (sem espaços)

3. Se esqueceu, gerar nova:
```bash
docker-compose exec backend npm run db:seed
# Saída terá nova chave
```

### Erro: "Workspace não encontrado"

**Causa**: Workspace "default" não existe

```bash
docker-compose exec backend npm run db:seed
```

### Token expirado a cada login

**Causa**: JWT_EXPIRY muito curto

```bash
# Editar backend/.env
JWT_EXPIRY="48h"  # padrão é 24h

docker-compose restart backend
```

## 🔴 WhatsApp não conecta

### Erro: "QR Code não aparece"

1. Verificar se serviço iniciou:
```bash
docker-compose logs backend | grep WhatsApp
```

2. Recarregar página
3. Se persistir, problema no provider WebQR:
```bash
# Tentar reset
docker-compose restart backend
```

### Erro: "Session expired" (bloqueio do WhatsApp)

**Causa**: WhatsApp Web bloqueou sessão

**Solução**:
1. Resetar sessão:
```bash
docker-compose exec backend rm -rf /app/sessions/*
docker-compose restart backend
```

2. Tentar nova conexão com QR

3. Se continuar, WhatsApp pode ter bloqueado a conta por automação
   - **Considerar migrar para Cloud API** (mais seguro)

### Erro: "Mensagem não enviada" depois de conectar

1. Verificar se lead tem numero válido (formato: 55 + área + número)
2. Verificar opt-in: `GET /crm/leads/:id`
3. Logs: `docker-compose logs backend | grep -i whatsapp`

## 🔴 Gemini não responde

### Erro: "API Key inválida"

1. Verificar chave em: https://makersuite.google.com/app/apikey
2. Copiar corretamente (sem espaços)
3. Salvar em Dashboard → Settings → Gemini

### Erro: "Quota exceeded"

**Causa**: Limite gratuito de Gemini atingido

**Solução**: 
- Ativar pagamento em Google Cloud
- Ou usar rate limiting mais restritivo

### Gemini ativado mas não responde

1. Verificar se está habilitado:
```bash
curl http://localhost:3000/settings/gemini \
  -H "Authorization: Bearer $TOKEN"
```

2. Testar conexão:
```bash
curl -X POST http://localhost:3000/settings/gemini/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Teste"}'
```

3. Se erro 500, verificar logs: `docker-compose logs backend`

## 🔴 Disparos não enviam

### Broadcasts ficam em "RUNNING" infinitamente

1. Verificar fila Redis:
```bash
docker-compose exec redis redis-cli

> LLEN bull:broadcast:

# Se > 1000, ficar muito quantidade
> FLUSHDB  # Limpar (cuidado!)
```

2. Reiniciar worker de broadcast:
```bash
docker-compose restart backend
```

### Erro: "Rate limit exceeded"

**Causa**: Muitos disparos simultâneos

**Solução**:
- Aumentar `messagesPerMinute` no broadcast
- Aguardar processamento

### Algumas mensagens não enviam

1. Verificar opt-in dos leads:
```bash
# Listar leads NÃO optados
curl "http://localhost:3000/crm/leads?optIn=false" \
  -H "Authorization: Bearer $TOKEN"
```

2. Verificar números inválidos:
```sql
SELECT phone_number, COUNT(*) FROM leads 
WHERE phone_number NOT LIKE '55%'
GROUP BY phone_number;
```

## 🔴 Performance lenta

### Dashboard lento ao carregar leads

1. Verificar índices do PostgreSQL:
```sql
SELECT * FROM pg_stat_user_indexes;
```

2. Adicionar índice se faltando:
```sql
CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
```

3. Limpar dados antigos:
```sql
DELETE FROM audit_log 
WHERE created_at < NOW() - INTERVAL '6 months';

VACUUM FULL;
```

### Redis consumindo muita memória

1. Ver tamanho:
```bash
docker-compose exec redis redis-cli INFO memory
```

2. Limpar jobs antigos:
```bash
docker-compose exec redis redis-cli

# Ver fila
> LLEN bull:broadcast:
> LLEN bull:ai-processing:

# Remover entradas
> DEL bull:broadcast:
```

### Muita CPU (backend)

1. Ver processo:
```bash
docker stats backend
```

2. Aumentar workers de fila:
```bash
# backend/.env
WORKER_CONCURRENCY=10  # padrão 5
```

3. Resetar fila:
```bash
docker-compose exec redis redis-cli FLUSHDB
docker-compose restart backend
```

## 🔴 Problemas de Deploy

### Imagem Docker não faz build

```bash
# Limpar cache
docker buildx prune -af

# Rebuiidar sem cache
docker build --no-cache -t seu-usuario/whatsapp-crm-backend:v1.0.1 ./backend

# Push
docker push seu-usuario/whatsapp-crm-backend:v1.0.1
```

### Container fica em restart loop

1. Ver erro:
```bash
docker-compose logs backend --tail 50
```

2. Problemas comuns:
   - Porta em uso: `lsof -i :3000`
   - Out of memory: `free -h`
   - Disco cheio: `df -h`

### Servidor fora do ar

1. Verificar serviço:
```bash
ssh seu-servidor
docker ps
```

2. Restar containers:
```bash
docker-compose up -d
```

3. Ver erros críticos:
```bash
docker-compose logs postgres
docker-compose logs redis
docker-compose logs backend
```

## 🟡 Comportamentos Estranhos

### Leads aparecem duplicados

```sql
-- Verificar duplicatas
SELECT phone_number, COUNT(*) as count 
FROM leads 
GROUP BY phone_number 
HAVING COUNT(*) > 1;

-- Mesclar (manualmente no admin)
-- Ou script de dedup
```

### Mensagens antigas não aparecem

1. Verificar se conversa foi arquivada:
```sql
SELECT status FROM conversations WHERE id = '...';
```

2. Se `ARCHIVED`, reabrir:
```bash
# Seria implementar endpoint de restore
```

### Paginação de leads quebrada

```bash
# Testar com limite
curl "http://localhost:3000/crm/leads?limit=10&page=0" \
  -H "Authorization: Bearer $TOKEN"

# Verificar se retorna 10 itens
```

## ℹ️ Comandos Úteis

```bash
# Status geral
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Entrar no container backend
docker-compose exec backend bash

# Rodar migrate
docker-compose exec backend npm run db:migrate

# Fazer seed
docker-compose exec backend npm run db:seed

# Acessar PostgreSQL
docker-compose exec postgres psql -U whatsapp_user -d whatsapp_crm

# Acessar Redis CLI
docker-compose exec redis redis-cli

# Parar tudo
docker-compose down

# Parar e remover volumes (cuidado: apaga dados!)
docker-compose down -v

# Rebuiidar imagem
docker-compose up -d --build backend

# Ver logs de 1 hora atrás
docker-compose logs backend --since 1h

# Copiar arquivo do container
docker-compose cp backend:/app/storage/arquivo.jpg ./

# Executar comando no container
docker-compose exec backend npm run db:migrate
```

## 📞 Contatos para Suporte

- **WhatsApp**: Comunidade @ GitHub Discussions
- **Gemini**: support@google.com
- **Docker**: docs.docker.com
- **PostgreSQL**: postgresql.org/support
- **Redis**: redis.io/docs

---

**Não encontrou sua solução?** Abra uma issue com:
- Comando que rodou
- Erro completo (logs)
- Configuração (sem credenciais!)
- Sistema operacional
