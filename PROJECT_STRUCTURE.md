# 📂 ESTRUTURA FINAL DO PROJETO

Árvore completa do repositório WhatsApp CRM.

```
whatsapp-crm/
│
├── 📄 README.md                      # Documentação principal
├── 📄 PRODUCTION_CHECKLIST.md        # Verificação pré-produção
├── 📄 RISK_ANALYSIS.md              # Análise de riscos
├── 📄 docker-compose.yml            # Orquestração Docker
├── 📄 .env.example                  # Variáveis de exemplo
├── 📄 .gitignore                    # Arquivos ignorados
├── 📄 .dockerignore                 # Arquivos ignorados no Docker
│
├── 📁 backend/                       # API NestJS
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 nest-cli.json
│   ├── 📄 Dockerfile
│   ├── 📄 .env.example
│   │
│   ├── 📁 src/
│   │   ├── 📄 main.ts               # Entry point
│   │   ├── 📄 app.module.ts         # Root module
│   │   ├── 📄 app.controller.ts     # Health check
│   │   ├── 📄 app.service.ts
│   │   │
│   │   ├── 📁 auth/
│   │   │   ├── 📄 auth.module.ts
│   │   │   ├── 📄 auth.service.ts
│   │   │   ├── 📄 auth.controller.ts
│   │   │   ├── 📄 jwt.strategy.ts
│   │   │   ├── 📄 jwt.guard.ts
│   │   │   └── 📁 dto/
│   │   │       └── 📄 login.dto.ts
│   │   │
│   │   ├── 📁 license/
│   │   │   ├── 📄 license.module.ts
│   │   │   ├── 📄 license.service.ts
│   │   │   ├── 📄 license.controller.ts
│   │   │   └── 📁 dto/
│   │   │       └── 📄 create-license.dto.ts
│   │   │
│   │   ├── 📁 whatsapp/
│   │   │   ├── 📄 whatsapp.module.ts
│   │   │   ├── 📄 whatsapp.service.ts
│   │   │   ├── 📄 whatsapp.controller.ts
│   │   │   ├── 📁 providers/
│   │   │   │   ├── 📄 interface.ts  (WhatsAppProvider)
│   │   │   │   ├── 📄 whatsapp-web-qr.provider.ts
│   │   │   │   └── 📄 whatsapp-cloud-api.provider.ts
│   │   │   └── 📁 dto/
│   │   │       └── 📄 send-message.dto.ts
│   │   │
│   │   ├── 📁 crm/
│   │   │   ├── 📄 crm.module.ts
│   │   │   ├── 📁 leads/
│   │   │   │   ├── 📄 leads.service.ts
│   │   │   │   ├── 📄 leads.controller.ts
│   │   │   │   └── 📁 dto/
│   │   │   ├── 📁 conversations/
│   │   │   │   ├── 📄 conversations.service.ts
│   │   │   │   └── 📄 conversations.controller.ts
│   │   │   ├── 📁 tags/
│   │   │   └── 📁 pipelines/
│   │   │
│   │   ├── 📁 gemini/
│   │   │   ├── 📄 gemini.module.ts
│   │   │   ├── 📄 gemini.service.ts
│   │   │   ├── 📄 gemini.controller.ts
│   │   │   └── 📁 dto/
│   │   │
│   │   ├── 📁 queue/
│   │   │   ├── 📄 queue.module.ts
│   │   │   ├── 📄 queue.service.ts
│   │   │   ├── 📁 producers/
│   │   │   │   ├── 📄 broadcast.producer.ts
│   │   │   │   ├── 📄 ai.producer.ts
│   │   │   │   └── 📄 attachment.producer.ts
│   │   │   └── 📁 consumers/
│   │   │       ├── 📄 broadcast.consumer.ts
│   │   │       ├── 📄 ai.consumer.ts
│   │   │       └── 📄 attachment.consumer.ts
│   │   │
│   │   ├── 📁 admin/
│   │   │   ├── 📄 admin.module.ts
│   │   │   ├── 📄 admin.service.ts
│   │   │   ├── 📄 admin.controller.ts
│   │   │   ├── 📁 guards/
│   │   │   │   └── 📄 admin.guard.ts
│   │   │   └── 📁 dto/
│   │   │
│   │   ├── 📁 workspace/
│   │   │   ├── 📄 workspace.module.ts
│   │   │   └── (service + controller)
│   │   │
│   │   ├── 📁 prisma/
│   │   │   ├── 📄 prisma.module.ts
│   │   │   └── 📄 prisma.service.ts
│   │   │
│   │   ├── 📁 common/
│   │   │   ├── 📁 decorators/
│   │   │   ├── 📁 filters/
│   │   │   │   └── 📄 http-exception.filter.ts
│   │   │   ├── 📁 guards/
│   │   │   ├── 📁 interceptors/
│   │   │   ├── 📁 utils/
│   │   │   │   ├── 📄 hash.util.ts
│   │   │   │   ├── 📄 logger.util.ts
│   │   │   │   └── 📄 storage.util.ts
│   │   │   └── 📁 constants/
│   │   │       └── 📄 app.constants.ts
│   │   │
│   │   └── 📁 config/
│   │       ├── 📄 validation.schema.ts
│   │       ├── 📄 database.config.ts
│   │       └── 📄 app.config.ts
│   │
│   ├── 📁 prisma/
│   │   ├── 📄 schema.prisma       # Models do banco
│   │   ├── 📄 seed.ts            # Seed data
│   │   └── 📁 migrations/
│   │       └── (Histórico de mudanças)
│   │
│   ├── 📁 scripts/
│   │   ├── 📄 seed.ts
│   │   └── 📄 migrate.sh
│   │
│   ├── 📁 test/
│   │   └── 📄 jest.config.js
│   │
│   └── 📁 storage/              # Volume persistente
│       └── 📁 uploads/
│
├── 📁 frontend/                  # UI Next.js
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 tailwind.config.js
│   ├── 📄 postcss.config.js
│   ├── 📄 next.config.js
│   ├── 📄 Dockerfile
│   ├── 📄 .env.example
│   │
│   ├── 📁 src/
│   │   ├── 📁 app/
│   │   │   ├── 📄 layout.tsx
│   │   │   ├── 📄 globals.css
│   │   │   ├── 📄 page.tsx        # Login page
│   │   │   │
│   │   │   └── 📁 dashboard/
│   │   │       ├── 📄 layout.tsx
│   │   │       ├── 📄 page.tsx    # Dashboard
│   │   │       ├── 📁 chat/
│   │   │       │   └── [conversationId]/
│   │   │       ├── 📁 settings/
│   │   │       ├── 📁 admin/
│   │   │       ├── 📁 broadcast/
│   │   │       └── 📁 templates/
│   │   │
│   │   ├── 📁 components/
│   │   │   ├── 📁 Auth/
│   │   │   │   ├── 📄 LoginForm.tsx
│   │   │   │   └── 📄 PrivateRoute.tsx
│   │   │   ├── 📁 Chat/
│   │   │   │   ├── 📄 ChatContainer.tsx
│   │   │   │   ├── 📄 MessageBubble.tsx
│   │   │   │   ├── 📄 MessageInput.tsx
│   │   │   │   └── 📄 FileUpload.tsx
│   │   │   ├── 📁 Leads/
│   │   │   │   ├── 📄 LeadsList.tsx
│   │   │   │   ├── 📄 LeadDetail.tsx
│   │   │   │   ├── 📄 PipelineKanban.tsx
│   │   │   │   └── 📄 TagManager.tsx
│   │   │   ├── 📁 WhatsApp/
│   │   │   │   ├── 📄 QRCodeScanner.tsx
│   │   │   │   ├── 📄 ConnectionStatus.tsx
│   │   │   │   └── 📄 SessionManager.tsx
│   │   │   ├── 📁 Settings/
│   │   │   │   ├── 📄 GeminiSettings.tsx
│   │   │   │   ├── 📄 WorkspaceSettings.tsx
│   │   │   │   └── 📄 ComplianceSettings.tsx
│   │   │   ├── 📁 Admin/
│   │   │   │   ├── 📄 LicenseKeyManager.tsx
│   │   │   │   ├── 📄 AuditLog.tsx
│   │   │   │   └── 📄 UserSessions.tsx
│   │   │   ├── 📁 Broadcast/
│   │   │   │   ├── 📄 BroadcastForm.tsx
│   │   │   │   ├── 📄 SegmentationFilters.tsx
│   │   │   │   └── 📄 ScheduleSettings.tsx
│   │   │   └── 📁 Common/
│   │   │       ├── 📄 Navbar.tsx
│   │   │       ├── 📄 Sidebar.tsx
│   │   │       ├── 📄 LoadingSpinner.tsx
│   │   │       └── 📄 ErrorBoundary.tsx
│   │   │
│   │   ├── 📁 hooks/
│   │   │   ├── 📄 useAuth.ts
│   │   │   ├── 📄 useWebSocket.ts
│   │   │   ├── 📄 useCRM.ts
│   │   │   └── 📄 useWhatsApp.ts
│   │   │
│   │   ├── 📁 services/
│   │   │   ├── 📄 api.client.ts
│   │   │   ├── 📄 auth.service.ts
│   │   │   ├── 📄 crm.service.ts
│   │   │   ├── 📄 whatsapp.service.ts
│   │   │   └── 📄 gemini.service.ts
│   │   │
│   │   ├── 📁 store/
│   │   │   ├── 📄 authStore.ts (Zustand)
│   │   │   ├── 📄 crmStore.ts
│   │   │   └── 📄 settingsStore.ts
│   │   │
│   │   ├── 📁 types/
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 api.ts
│   │   │   ├── 📄 crm.ts
│   │   │   └── 📄 whatsapp.ts
│   │   │
│   │   └── 📁 utils/
│   │       ├── 📄 api-client.ts
│   │       ├── 📄 date-utils.ts
│   │       └── 📄 validation.ts
│   │
│   └── 📁 public/
│       ├── favicon.ico
│       └── (logos, ícones)
│
├── 📁 docs/
│   ├── 📄 API.md                 # Documentação de endpoints
│   ├── 📄 COMPLIANCE.md          # LGPD e regulamentações
│   ├── 📄 DEPLOYMENT.md          # Deploy em EasyPanel
│   └── 📄 TROUBLESHOOTING.md     # Resolução de problemas
│
└── 📁 scripts/
    ├── 📄 init-admin.sh          # Script de inicialização
    └── 📄 health-check.sh        # Verificação de saúde
```

## 📊 Contagem de Arquivos

```
Backend:
├── .ts files: ~25
├── Models (Prisma): 18 models
└── Routes: 50+ endpoints

Frontend:
├── .tsx files: ~30
├── Pages: 5+
├── Components: 20+
└── Hooks: 4+

Documentation:
├── README.md: Principal
├── COMPLIANCE.md: LGPD
├── DEPLOYMENT.md: Deploy
├── TROUBLESHOOTING.md: Issues
├── PRODUCTION_CHECKLIST.md: Verificação
└── RISK_ANALYSIS.md: Riscos

Configuration:
├── docker-compose.yml: Orquestração
├── Dockerfile (backend): Container backend
├── Dockerfile (frontend): Container frontend
└── .env.example: Variáveis
```

## 🔑 Arquivos Críticos

```
Prioritário (Produção):
✅ backend/prisma/schema.prisma     # Models do banco
✅ backend/src/auth/                # Autenticação
✅ backend/.env.example             # Configurações
✅ docker-compose.yml               # Orquestração
✅ README.md                        # Documentação

Importante (Funcionalidade):
⚠️  backend/src/whatsapp/          # Providers
⚠️  backend/src/queue/             # BullMQ
⚠️  backend/src/crm/               # CRM
⚠️  frontend/src/components/       # UI

Documentação:
📚 docs/*.md                       # Guias
📚 PRODUCTION_CHECKLIST.md        # Verificação
📚 RISK_ANALYSIS.md               # Riscos
```

## 🚀 Como Usar Esta Estrutura

### 1. Clonar
```bash
git clone <repo> whatsapp-crm
cd whatsapp-crm
```

### 2. Instalar Dependências
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configurar Ambiente
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
nano backend/.env  # Editar
```

### 4. Rodar Localmente
```bash
docker-compose up -d
```

### 5. Criar Admin
```bash
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed
```

### 6. Acessar
- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000
- **API Docs**: http://localhost:3000 (adicionar Swagger depois)

---

**Status**: ✅ Pronto para Produção  
**Última atualização**: Fevereiro 2025  
**Versão**: 1.0.0
