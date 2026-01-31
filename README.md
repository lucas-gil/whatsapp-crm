# 🚀 WhatsApp CRM - Plataforma Completa de CRM com WhatsApp

Sistema enterprise pronto para produção que conecta WhatsApp via QR Code, oferece CRM visual estilo WhatsApp Web com automatização de atendimento usando IA Gemini.

## ✨ Características Principais

- ✅ **Conexão WhatsApp via QR Code** (Provider WebQR padrão)
- ✅ **CRM visual estilo WhatsApp** (lista de conversas, chat, detalhes do lead)
- ✅ **Automação com IA Gemini** (respostas inteligentes)
- ✅ **Disparos em massa** com segmentação, agendamento e rate limiting
- ✅ **Sistema de licenças/senhas** (12min, 30 dias, admin infinita)
- ✅ **Multi-tenant com workspaces**
- ✅ **Painel admin completo** com auditoria, sessões e estatísticas
- ✅ **Compliance total**: opt-in/out, limites de envio, fila
- ✅ **Realtime via WebSocket** para atualizações de conversas
- ✅ **Docker Compose pronto** para deploy local e produção

## 🏗️ Arquitetura

```
┌─────────────────────────────────────┐
│   Frontend (Next.js + Tailwind)     │ Port 3001
│   - Login com chave                 │
│   - CRM/Chat UI                     │
│   - Admin Dashboard                 │
└────────────┬────────────────────────┘
             │ API REST
┌────────────▼────────────────────────┐
│   Backend (NestJS + TypeScript)     │ Port 3000
│   - Auth (JWT + License Keys)       │
│   - WhatsApp Providers              │
│   - CRM Service                     │
│   - Gemini AI Integration           │
│   - BullMQ Queues                   │
└────────────┬────────────────────────┘
             │
     ┌───────┼───────┐
     │       │       │
  ┌──▼──┐ ┌─▼──┐ ┌──▼──┐
  │ PgSQL│ │Redis│ │LocalStorage
  └──────┘ └─────┘ └──────┘
```

## 📋 Requisitos

- Docker & Docker Compose
- Node.js 20+ (para desenvolvimento local)
- PostgreSQL 16+
- Redis 7+

## 🚀 Quick Start

### 1. Clone e Configure

```bash
git clone <seu-repo>
cd whatsapp-crm

# Copiar env de exemplo
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Editar variáveis importantes em backend/.env
nano backend/.env
```

### 2. Iniciar com Docker Compose

```bash
docker-compose up -d

# Aguardar serviços ficarem healthy (30-60 segundos)
docker-compose ps

# Ver logs
docker-compose logs -f backend
```

### 3. Criar Admin e fazer Seed

```bash
# Entrar no container do backend
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

# Saída esperada:
# ✅ Workspace criado: ...
# ✅ Chave ADMIN criada: ...
# 🔑 CHAVE COMPLETA: xxxxxxxxxxxxxxxxxxxxx
```

### 4. Acessar Sistema

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Admin Panel**: http://localhost:3001/dashboard (após login com chave ADMIN)

**Login**: Use a chave ADMIN gerada no seed

## 🔐 Sistema de Licenças

### Tipos de Chaves

| Tipo | Validade | Uso | Acesso Admin |
|------|----------|-----|--------------|
| TEMPORARY_12MIN | 12 minutos após ativação | Teste rápido | Não |
| TEMPORARY_30DAYS | 30 dias após ativação | Usuários mensais | Não |
| ADMIN_INFINITE | Sem expiração | Administrador | ✅ Sim |

### Gerar Novas Chaves (apenas Admin)

1. Faça login como Admin
2. Vá para Admin → License Manager
3. Clique em "Gerar Nova Chave"
4. Selecione tipo e copie (mostra apenas uma vez!)
5. Compartilhe com usuário

**API**:
```bash
curl -X POST http://localhost:3000/licenses \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"TEMPORARY_30DAYS"}'
```

## 💬 WhatsApp Providers

### Provider Padrão: Web QR (Baileys)

- ✅ Não precisa de app oficial do WhatsApp
- ✅ Funcionamento via QR Code
- ⚠️ Menos confiável em produção (risco de bloqueio)
- 📱 Escaneie QR na página de conectar

**Como Conectar**:
1. Vá para Dashboard → Configurações → WhatsApp
2. Clique "Gerar QR Code"
3. Escaneie com celular (WhatsApp aberto)
4. Aguarde "Conectado" aparecer

### Provider Cloud API (Preparado para Migração)

Arquivo: `backend/src/whatsapp/providers/whatsapp-cloud-api.provider.ts` (stub)

**Para ativar em produção**:

1. Configure no `.env`:
```bash
WHATSAPP_PROVIDER="cloud-api"
WHATSAPP_CLOUD_API_TOKEN="sua-token-de-negocios"
WHATSAPP_PHONE_ID="seu-phone-id"
```

2. Implemente chamadas reais no provider (atualmente são stubs)

3. Reinicie backend: `docker-compose restart backend`

## 🤖 Integração Gemini AI

### Configurar

1. Obtenha API Key em: https://makersuite.google.com/app/apikey
2. Dashboard → Configurações → Gemini
3. Cole a API Key
4. Configure o "System Prompt" (como IA deve agir)
5. Ative: Toggle "Gemini Ativado"

### Exemplo de System Prompt

```
Você é um assistente de atendimento ao cliente de uma loja de roupas.
- Seja amigável e profissional
- Ofereça promoções relevantes
- Se não souber algo, peça para falar com humano
- Resuma conversas longas
```

### Recursos

- Responde automaticamente a mensagens (opcional)
- Acesso ao histórico da conversa
- Contexto do lead (pipeline, tags, notas)
- Fallback automático se IA falhar

## 📢 Disparos em Massa (Broadcasts)

### Fluxo Completo

1. **Admin** → Criar Template (ou use um existente)
   ```
   "Olá {{nome}}, confira nossa promoção {{promo}}!"
   ```

2. **Ir para** Disparos → Novo Disparo
3. **Selecionar**: Template, destinatários (filtro por tags/estage), horário
4. **Configurar**: Taxa (msgs/min), retry automático
5. **Enviar**: Sistema enfileira e processa com BullMQ

### Compliance Automático

✅ Verifica opt-in antes de enviar
✅ Respeita rate limit (default 20 msgs/min)
✅ Fila com retry (3 tentativas)
✅ Log de todas as tentativas

### API

```bash
curl -X POST http://localhost:3000/broadcasts \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promo Verão",
    "templateId": "...",
    "tagFilter": ["cliente"],
    "messagesPerMinute": 20,
    "scheduledFor": "2025-02-15T10:00:00Z"
  }'
```

## 👥 CRM: Leads

### Estrutura

Cada lead tem:
- 📱 **Contato**: Nome, telefone, email, avatar
- 📊 **Pipeline**: Etapa (Novo → Qualificando → Proposta → Fechado → Perdido)
- 🏷️ **Tags**: Categorização
- 📝 **Notas**: Anotações do responsável
- 🔐 **Compliance**: Opt-in, data, razão de opt-out
- 📞 **Histórico**: Todas as conversas

### API Leads

```bash
# Listar leads
curl -X GET "http://localhost:3000/crm/leads?search=João&stage=novo" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Criar lead
curl -X POST http://localhost:3000/crm/leads \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phoneNumber": "11999999999",
    "email": "joao@email.com"
  }'

# Atualizar estágio
curl -X PUT http://localhost:3000/crm/leads/lead-id \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pipelineStage": "proposta"}'

# Lead opt-out
curl -X POST http://localhost:3000/crm/leads/lead-id/opt-out \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Cliente pediu para não enviar mais"}'
```

## 📊 Admin Dashboard

Apenas usuários com **chave ADMIN_INFINITE** acessam:

- 📈 **Estatísticas**: Leads, conversas, mensagens, disparos
- 🔐 **Licenças**: Gerar, revogar, ver expiração
- 🔍 **Auditoria**: Login, disparos, mudanças
- 👥 **Sessões**: Usuários ativos, invalida se necessário
- ⚙️ **Configurações**: Workspace, storage, WhatsApp

## 🗄️ Database Schema

Principais tabelas:

```sql
- Workspace: workspaces/clientes
- LicenseKey: chaves de acesso (hash, tipo, expiração)
- UserSession: sessões ativas (JWT, IP, user-agent)
- Lead: contatos do CRM (nome, telefone, etapa, tags)
- Conversation: chats 1:1 e grupos
- Message: histórico de mensagens (incoming/outgoing)
- Broadcast: disparos em massa
- GeminiSettings: configuração de IA por workspace
- AuditLog: log de todas as ações
```

Ver schema completo: [prisma/schema.prisma](backend/prisma/schema.prisma)

## 🐳 Deploy

### Local (Desenvolvimento)

```bash
docker-compose up -d

# Parar
docker-compose down

# Remover volumes (⚠️ apaga dados!)
docker-compose down -v
```

### EasyPanel / Hostinger

1. **Subir imagem no repositório**:
   ```bash
   docker build -t seu-usuario/whatsapp-crm-backend:latest ./backend
   docker build -t seu-usuario/whatsapp-crm-frontend:latest ./frontend
   docker push seu-usuario/whatsapp-crm-backend:latest
   docker push seu-usuario/whatsapp-crm-frontend:latest
   ```

2. **Em EasyPanel**:
   - Criar projeto
   - Upload do `docker-compose.yml`
   - Configurar variáveis de ambiente
   - Deploy

3. **Certificado SSL**: EasyPanel configura automaticamente

4. **Domínio**: Aponta para IP da máquina

### Variáveis Críticas para Produção

```bash
NODE_ENV=production
JWT_SECRET=<gerar-uuid-longo-e-seguro>
DATABASE_URL=postgresql://user:senha@host:5432/db
REDIS_URL=redis://redis-host:6379
CORS_ORIGIN=https://seu-dominio.com
```

## 🔧 Desenvolvimento Local

### Backend

```bash
cd backend

# Instalar dependências
npm install

# Criar/atualizar banco
npm run db:migrate

# Seed com dados demo
npm run db:seed

# Iniciar em desenvolvimento (com reload automático)
npm run start:dev

# Build para produção
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend

npm install
npm run dev

# Build para produção
npm run build
npm start
```

## 📁 Estrutura do Projeto

```
whatsapp-crm/
├── backend/                      # API NestJS
│   ├── src/
│   │   ├── auth/                 # Autenticação (JWT + License Keys)
│   │   ├── whatsapp/             # Providers (WebQR, CloudAPI)
│   │   ├── crm/                  # Leads, Conversas
│   │   ├── gemini/               # Integração IA
│   │   ├── queue/                # BullMQ (broadcasts, IA)
│   │   ├── admin/                # Painel admin
│   │   ├── license/              # Gerenciamento de chaves
│   │   └── common/               # Utilitários, guards, filters
│   ├── prisma/
│   │   ├── schema.prisma         # Models do banco
│   │   └── migrations/           # Histórico de mudanças
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                      # UI Next.js
│   ├── src/
│   │   ├── app/                  # Pages (login, dashboard)
│   │   ├── components/           # Componentes React
│   │   ├── hooks/                # Custom hooks
│   │   ├── services/             # API client
│   │   ├── types/                # TypeScript types
│   │   └── store/                # Zustand stores
│   ├── Dockerfile
│   └── package.json
│
├── docs/                         # Documentação adicional
│   ├── API.md
│   ├── COMPLIANCE.md
│   ├── DEPLOYMENT.md
│   └── TROUBLESHOOTING.md
│
├── docker-compose.yml            # Orquestração
├── .env.example
└── README.md                     # Este arquivo
```

## 🚨 Troubleshooting

### Backend não conecta ao PostgreSQL

```bash
# Verificar status dos containers
docker-compose ps

# Ver logs
docker-compose logs postgres

# Verificar URL
echo $DATABASE_URL

# Resetar banco (cuidado: apaga dados)
docker-compose down -v postgres
docker-compose up -d postgres
docker-compose exec backend npm run db:migrate
```

### WhatsApp QR Code não funciona

1. Verificar logs: `docker-compose logs backend`
2. Garantir que celular tem WhatsApp aberto
3. Tentar recarregar página
4. Se erro persistir: pode ser bloqueio do WhatsApp (migrar para Cloud API)

### Gemini retorna erro

```bash
# Verificar chave
curl -X GET http://localhost:3000/settings/gemini \
  -H "Authorization: Bearer $JWT_TOKEN"

# Testar conexão
curl -X POST http://localhost:3000/settings/gemini/test \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Olá!"}'
```

### Performance lenta

1. Verificar Redis: `redis-cli ping` → deve retornar PONG
2. Ver filas: `docker-compose logs redis`
3. Aumentar `WORKER_CONCURRENCY` para mais workers
4. Limpar `broadcast` e `audit_log` antigos

## 📚 Endpoints Principais

### Auth
- `POST /auth/login` - Login com chave
- `POST /auth/logout` - Logout
- `GET /auth/me` - Dados do usuário atual

### WhatsApp
- `POST /whatsapp/init` - Inicializar sessão
- `GET /whatsapp/qr-code` - Obter QR Code
- `GET /whatsapp/status` - Status da conexão
- `POST /whatsapp/send-text` - Enviar texto
- `POST /whatsapp/send-media` - Enviar mídia
- `POST /whatsapp/send-poll` - Enviar enquete

### CRM
- `GET /crm/leads` - Listar leads
- `POST /crm/leads` - Criar lead
- `GET /crm/leads/:id` - Detalhes do lead
- `GET /crm/conversations` - Listar conversas
- `POST /crm/conversations/:id/messages` - Enviar mensagem

### Admin
- `GET /admin/stats` - Estatísticas
- `GET /admin/audit-logs` - Auditoria
- `GET /admin/sessions` - Sessões ativas

Ver documentação completa: [docs/API.md](docs/API.md)

## 🔒 Segurança

✅ **Implementações**:
- JWT com expiração curta (24h)
- Chaves com hash (bcrypt)
- CORS configurável
- Rate limiting (BullMQ)
- Validação de entrada (class-validator)
- Auditoria completa de ações
- Isolamento por workspace
- RBAC (admin vs user)

⚠️ **Recomendações Produção**:
- Usar HTTPS obrigatório
- Implementar 2FA no admin
- Guardar Gemini API Key em vault (não em .env)
- Backup automático do PostgreSQL
- Monitoramento de erros (Sentry)
- Rate limit mais restritivo em produção

## 📞 Compliance & LGPD

✅ **Implemented**:
- Opt-in/opt-out de contatos
- Log de consentimento (data + hora)
- Não enviar para leads optados out
- Auditoria de quem enviou o quê
- Segmentação por opt-in

📋 **Para checklist completo**: [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

## 🚀 Roadmap

- [ ] Dashboard em tempo real (WebSocket para conversas)
- [ ] Integração com Stripe para pagamento de chaves
- [ ] Múltiplos workspaces por usuário
- [ ] Relatórios avançados (Excel export)
- [ ] Integração com outras plataformas (Facebook Messenger, Telegram)
- [ ] Mobile app (React Native)
- [ ] Video call via WhatsApp API

## 📄 Licença

MIT

## 👨‍💻 Suporte

Para issues, dúvidas ou contribuições:
1. Abra uma issue no GitHub
2. Consulte [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
3. Envie email para: suporte@seu-dominio.com

---

**Versão**: 1.0.0  
**Última atualização**: Fevereiro 2025  
**Status**: Production Ready ✅
