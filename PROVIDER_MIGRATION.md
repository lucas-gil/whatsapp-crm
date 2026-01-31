# 🔄 MIGRATION: WebQR → Cloud API

Guia passo a passo para migrar do Provider WebQR (Baileys) para WhatsApp Cloud API.

---

## 📋 Quando Migrar

**Sinais que é hora**:
- ✅ Mais de 100 disparos/dia
- ✅ Muitos bloqueios/checkpoints do WhatsApp
- ✅ Produção crítica com SLA
- ✅ Crescimento esperado > 1k msgs/dia
- ✅ Precisa de suporte oficial

**Manter WebQR quando**:
- ❌ Fase de testes
- ❌ Volume baixo (< 50 msgs/dia)
- ❌ Prototipagem rápida
- ❌ Não quer gerenciar API

---

## 🎯 Pré-requisitos

- [ ] Conta Facebook Business
- [ ] App registrado em Meta Developers
- [ ] Número de telefone aprovado para WhatsApp
- [ ] Webhook URL verificado
- [ ] Access token gerado

---

## 📊 Fase 1: Setup Cloud API (Dia 1-2)

### 1.1 Criar App no Meta

1. Ir para https://developers.facebook.com/
2. Meu Apps → Criar App → Tipo "Business"
3. Adicionar "WhatsApp" como produto
4. Configurar:
   ```
   App Name: WhatsApp CRM
   App Domains: seu-dominio.com
   Redirect URLs: https://seu-dominio.com/auth
   ```

### 1.2 Configurar Número

1. WhatsApp → Configurações
2. Ir para "Phone Numbers"
3. Verificar número com SMS/chamada
4. Copiar **Phone Number ID**: `101234567890`
5. Copiar **Business Account ID**: `987654321`

### 1.3 Gerar Access Token

1. WhatsApp → API Setup
2. Gerar token permanente (ou usar app)
3. Scopes necessários:
   ```
   whatsapp_business_messaging
   whatsapp_business_management
   ```

**Token formato**: `EAADxxx...` (salvar em vault)

### 1.4 Configurar Webhook

Backend precisa de endpoint para receber mensagens:

```typescript
// backend/src/whatsapp/webhook.controller.ts (novo)

@Post('webhook')
async handleWebhook(@Body() payload: any) {
  // Processar evento incoming
  // message, status_update, etc
}

@Get('webhook')
async verifyWebhook(
  @Query('hub.mode') mode: string,
  @Query('hub.challenge') challenge: string,
  @Query('hub.verify_token') token: string,
) {
  if (token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
}
```

Configure em Meta Developers:
- URL: `https://seu-dominio.com/whatsapp/webhook`
- Verify Token: `sua-chave-aleatoria`
- Subscribe fields: `messages`, `message_status`

---

## 🔧 Fase 2: Implementar Provider (Dia 2-3)

### 2.1 Completar CloudAPI Provider

Arquivo: `backend/src/whatsapp/providers/whatsapp-cloud-api.provider.ts`

```typescript
import axios from 'axios';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_URL = 'https://graph.instagram.com';

export class WhatsAppCloudAPIProvider implements WhatsAppProvider {
  private token: string;
  private phoneId: string;

  constructor(token: string, phoneId: string) {
    this.token = token;
    this.phoneId = phoneId;
  }

  async sendText(workspaceId: string, to: string, text: string): Promise<string> {
    try {
      const response = await axios.post(
        `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      return response.data.messages[0].id;
    } catch (error) {
      throw new Error(`Erro ao enviar: ${error.message}`);
    }
  }

  async sendMedia(
    workspaceId: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<string> {
    // 1. Upload para Facebook
    const formData = new FormData();
    formData.append('file', new Blob([media], { type: mimeType }));
    formData.append('type', mimeType);

    const uploadResponse = await axios.post(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${this.phoneId}/media`,
      formData,
      { headers: { Authorization: `Bearer ${this.token}` } },
    );

    const mediaId = uploadResponse.data.id;

    // 2. Enviar referência
    const type = mimeType.startsWith('image') ? 'image' : 'document';
    const messageResponse = await axios.post(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${this.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type,
        [type]: { id: mediaId, caption },
      },
      { headers: { Authorization: `Bearer ${this.token}` } },
    );

    return messageResponse.data.messages[0].id;
  }

  // Implementar outros métodos...
}
```

### 2.2 Adicionar ao .env

```bash
WHATSAPP_PROVIDER=web-qr  # Ainda padrão
WHATSAPP_CLOUD_API_TOKEN=EAADxxx...
WHATSAPP_PHONE_ID=1234567890
WHATSAPP_BUSINESS_ID=9876543210
WEBHOOK_VERIFY_TOKEN=sua-chave-aleatoria
```

### 2.3 Webhook Handler

```typescript
// backend/src/whatsapp/webhook.service.ts (novo)

@Injectable()
export class WebhookService {
  constructor(private conversationService: ConversationsService) {}

  async handleIncomingMessage(payload: any) {
    const message = payload.entry[0].changes[0].value.messages[0];
    
    // 1. Obter lead
    const lead = await this.leadsService.createLead(workspaceId, {
      name: payload.entry[0].changes[0].value.contacts[0].profile.name,
      phoneNumber: message.from,
    });

    // 2. Criar conversa
    const conversation = await this.conversationsService.getOrCreate(
      workspaceId,
      lead.id,
    );

    // 3. Registrar mensagem
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        text: message.text.body,
        direction: 'INCOMING',
        status: 'DELIVERED',
        whatsappMessageId: message.id,
      },
    });

    // 4. Processar IA se habilitado
    if (settings.isEnabled) {
      await this.aiProducer.enqueueAIProcessing(...);
    }
  }

  async handleMessageStatus(payload: any) {
    const status = payload.entry[0].changes[0].value.statuses[0];
    
    // Atualizar status da mensagem
    await this.prisma.message.update({
      where: { whatsappMessageId: status.id },
      data: { status: this.mapStatus(status.status) },
    });
  }

  private mapStatus(waStatus: string): MessageStatus {
    const map = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    return map[waStatus] || 'SENDING';
  }
}
```

---

## 🧪 Fase 3: Teste em Staging (Dia 3-4)

### 3.1 Ativar Provider

```bash
# backend/.env
WHATSAPP_PROVIDER=cloud-api

# Reiniciar backend
docker-compose restart backend
```

### 3.2 Testes Manuais

```bash
# Enviar mensagem de teste
curl -X POST http://localhost:3000/whatsapp/send-text \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "text": "Teste de Cloud API"
  }'

# Enviar para verificar webhook
# Usar ferramentas como Webhook.site para testar
```

### 3.3 Verificar Webhook

```bash
# Meta Developers → App → Webhooks
# Ver que está ativo e recebendo eventos

# Logs:
docker-compose logs backend | grep -i webhook
```

---

## 🔄 Fase 4: Dual-Write (Dia 5-6)

Ambos providers ativos, tráfego gradual para CloudAPI.

### 4.1 Strategy Pattern

```typescript
// backend/src/whatsapp/whatsapp.service.ts

async sendText(workspaceId: string, to: string, text: string) {
  const settings = await this.getSettings(workspaceId);
  
  let provider = this.webQRProvider;
  if (settings.provider === 'cloud-api') {
    provider = this.cloudAPIProvider;
  }

  // Fallback automático
  try {
    return await provider.sendText(workspaceId, to, text);
  } catch (error) {
    this.logger.error(`${settings.provider} falhou, tentando outro`);
    
    // Se CloudAPI falhou, tentar WebQR
    if (settings.provider === 'cloud-api') {
      return await this.webQRProvider.sendText(workspaceId, to, text);
    }
    throw error;
  }
}
```

### 4.2 Monitorar Métricas

```sql
-- Ver qual provider está sendo usado
SELECT 
  DATE_TRUNC('hour', created_at) as hora,
  COUNT(*) as total
FROM messages
WHERE direction = 'OUTGOING'
GROUP BY hora
ORDER BY hora DESC;
```

### 4.3 Gradual Traffic Shift

Dia 5: 10% → CloudAPI
Dia 6: 50% → CloudAPI
Dia 7: 100% → CloudAPI

```typescript
// Random routing para teste
const useCloudAPI = Math.random() < 0.1; // 10%
```

---

## ✂️ Fase 5: Sunset WebQR (Dia 7-8)

### 5.1 Remover WebQR

```typescript
// backend/src/app.module.ts
- WhatsAppWebQRProvider, // Remover

// Remover arquivo (ou keep como fallback)
// rm backend/src/whatsapp/providers/whatsapp-web-qr.provider.ts
```

### 5.2 Cleanup

```bash
# Remover Baileys do package.json
npm remove @whiskeysockets/baileys

# Remover volumes de sessão
docker-compose exec backend rm -rf /app/sessions/*

# Rebuild e deploy
docker build -t seu-usuario/whatsapp-crm-backend:v1.1.0 ./backend
docker push seu-usuario/whatsapp-crm-backend:v1.1.0
```

### 5.3 Deprecate Endpoints

```typescript
@Get('whatsapp/qr-code')
async getQRCode(@Request() req) {
  return {
    error: 'QR Code não é mais suportado. Use Cloud API.',
    status: 'DEPRECATED',
  };
}
```

---

## 🔙 Rollback (se necessário)

Se CloudAPI falhar severamente:

```bash
# Revert para WebQR
git checkout backend/src/whatsapp/providers/whatsapp-web-qr.provider.ts

# Editar .env
WHATSAPP_PROVIDER=web-qr

# Rebuild e restart
docker build -t seu-usuario/whatsapp-crm-backend:v1.0.0 ./backend
docker-compose restart backend
```

---

## 📊 Comparação: WebQR vs CloudAPI

| Aspecto | WebQR | CloudAPI |
|---------|-------|----------|
| **Segurança** | ⚠️ Alto risco | ✅ Oficial |
| **SLA** | ❌ Nenhum | ✅ 99.9% |
| **Setup** | ✅ Fácil | ⚠️ Complexo |
| **Custo** | ✅ Gratuito* | ⚠️ Per msg |
| **Limite** | ⚠️ ~1k/dia | ✅ Ilimitado |
| **Webhooks** | ❌ Não | ✅ Sim |
| **Grupos** | ✅ Suporta | ✅ Suporta |
| **Media** | ✅ Sim | ✅ Sim |
| **Produção** | ❌ Não recomendado | ✅ Recomendado |

*WebQR pode ser bloqueado a qualquer momento

---

## 💰 Custos (CloudAPI)

- Template messages: $0.0075 / msg
- Utility messages: $0.0015 / msg
- Marketing messages: $0.1 / msg (variável por país)

**Exemplo**: 1k msgs/dia = ~$1.50/dia = $45/mês

---

## ✅ Checklist de Migração

- [ ] CloudAPI setup completo
- [ ] Número verificado
- [ ] Token gerado e testado
- [ ] Webhook implementado
- [ ] Webhook verificado em Meta
- [ ] Provider CloudAPI implementado
- [ ] Testes em staging OK
- [ ] Dual-write funcionando
- [ ] Fallback automático testado
- [ ] Monitoramento ativo
- [ ] 10% tráfego migrado
- [ ] Zero erros por 24h
- [ ] 50% tráfego migrado
- [ ] 100% tráfego migrado
- [ ] WebQR removido
- [ ] Documentação atualizada

---

## 📞 Suporte Meta

- **Developers**: https://developers.facebook.com/
- **Docs**: https://developers.facebook.com/docs/whatsapp
- **Forum**: https://developers.facebook.com/community
- **Support**: https://business.facebook.com/support

---

**Estimativa**: 1 semana do início ao fim
**Risco**: Baixo (com fallback)
**Impacto**: Alto (produção segura)

Boa sorte na migração! 🚀
