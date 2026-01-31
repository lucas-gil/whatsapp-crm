# 📋 COMPLIANCE & LGPD

## ✅ Implementações de Compliance

### 1. Consentimento (Opt-in)

**Modelo no BD**:
```prisma
model Lead {
  id          String
  optIn       Boolean       @default(true)
  optInDate   DateTime?
  optOutDate  DateTime?
  optOutReason String?
}
```

**Fluxo**:
1. Ao criar lead manualmente → `optIn: true` por padrão
2. Ao receber msg do WhatsApp → `optIn: true` automaticamente (contato iniciou conversa)
3. Se lead enviar "PARAR" → marcar como `optOut: true` com data
4. Disparos verificam `optIn === true` antes de enviar

**API**:
```bash
# Fazer lead optar por sair
curl -X POST http://localhost:3000/crm/leads/{leadId}/opt-out \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"reason": "Cliente pediu"}'
```

### 2. Auditoria Completa

Toda ação registra em `AuditLog`:

```prisma
model AuditLog {
  action        AuditAction  // LOGIN, SEND_MESSAGE, BROADCAST_START, etc
  resourceType  String?      // "Lead", "Message", "Broadcast"
  resourceId    String?
  ipAddress     String?
  userAgent     String?
  details       Json?        // contexto adicional
  createdAt     DateTime
}
```

**Ações Rastreadas**:
- ✅ Login/Logout
- ✅ Criação/edição de lead
- ✅ Envio de mensagens individuais
- ✅ Início/pausa de disparos
- ✅ Ativação de Gemini
- ✅ Geração/revogação de chaves
- ✅ Mudanças de configuração
- ✅ Upload de arquivos

**Consultar Auditoria** (admin apenas):
```bash
curl -X GET http://localhost:3000/admin/audit-logs \
  -H "Authorization: Bearer $JWT_TOKEN"

# Retorna últimas 100 ações com IP, user-agent, timestamp
```

### 3. Restrições de Envio

**Rate Limiting**:
- Default: 20 mensagens/minuto por workspace
- Configurável no broadcast
- Implementado em BullMQ (fila)

**Limites Automáticos**:
- Máx 100 msgs em 5 min para o mesmo lead (anti-spam)
- Retry automático com backoff exponencial
- Máx 3 tentativas antes de marcar como falho

### 4. Data Retention

**Políticas Recomendadas** (implemente conforme necessário):

```bash
# Deletar leads inativos por 1 ano
DELETE FROM leads 
WHERE updated_at < NOW() - INTERVAL '1 year'
AND opt_in = false;

# Arquivar conversas antigas
UPDATE conversations 
SET status = 'CLOSED'
WHERE last_message_at < NOW() - INTERVAL '90 days'
AND status = 'ACTIVE';

# Limpar audit logs antigos
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '2 years';
```

### 5. Segurança de Dados

**Implementado**:
- ✅ Chaves de acesso com hash (bcrypt, nunca texto puro)
- ✅ JWT para sessão (expiração 24h)
- ✅ PostgreSQL com SSL em produção
- ✅ Isolamento por workspace (dados nunca vazam entre clientes)
- ✅ Validação de entrada em todas as rotas

**Recomendações**:
- Use HTTPS em produção
- Ative SSL na conexão do PostgreSQL
- Implemente 2FA para admin
- Guarde Gemini API Key em vault (não em .env)
- Backup diário do banco

### 6. Direitos do Titular

**Implementado**:
- ✅ Consultar dados: `GET /crm/leads/:id` retorna tudo
- ✅ Correção: `PUT /crm/leads/:id` edita dados
- ✅ Exclusão: Pode deletar lead (soft delete recomendado)
- ⚠️ Portabilidade: Implemente export para JSON/CSV

**Adicione**:
```bash
# API de export (implementar)
POST /crm/leads/{leadId}/export
GET /crm/data/export-all  # (admin)
```

## 📋 Checklist LGPD

- [ ] Política de privacidade publicada
- [ ] Termo de consentimento no signup
- [ ] Consentimento explícito antes de enviar marketing
- [ ] Opção de unsubscribe fácil (PARAR, opt-out)
- [ ] Log de consentimento (quem, quando, prova)
- [ ] Acesso a dados pessoais apenas por autorizado
- [ ] Dados criptografados em repouso e em trânsito
- [ ] Backup e disaster recovery
- [ ] Plano de response em caso de breach
- [ ] Data Protection Officer (DPO) nomeado
- [ ] RACI definido (quem faz o quê)
- [ ] Treinamento de funcionários sobre LGPD

## 🚨 Controles por Estágio de CRM

**Novo → Qualificando**:
- Enviar automaticamente boas-vindas (se Gemini ativo)
- Registrar data de primeiro contato

**Qualificando → Proposta**:
- Enviar proposta customizada
- Registrar data de envio

**Proposta → Fechado**:
- Confirmação de compra
- Enviar nota fiscal (integração futura)

**Qualquer → Perdido**:
- Remover de disparos automáticos
- Arquivar conversa

## 📊 Relatórios de Compliance

Criar manualmente no dashboard:

1. **Relatório de Consentimentos**
   - Filtro: Opt-in = true/false
   - Período: data inicio - data fim
   - Export: CSV com nome, telefone, data consentimento, IP

2. **Relatório de Disparos**
   - Broadcast: nome, data, destinatários
   - Sucesso rate, failed, opt-out
   - Arquivo de prova

3. **Relatório de Acessos (Auditoria)**
   - Login/logout: usuário, IP, data/hora
   - Ações: o quê, quem, quando

4. **Relatório de Retenção**
   - Dados deletados
   - Período de retenção aplicado

## 🔐 Criptografia (Implementar em Produção)

```typescript
// Exemplo para armazenar Gemini API Key de forma segura

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 chars

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const [iv, encrypted] = text.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, 'hex'),
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## 📧 Notificações de Segurança

**Enviar email quando**:
- Nova chave gerada
- Chave revogada
- Disparos em massa iniciados
- Falha de autenticação 3x
- Acesso de IP novo
- Mudança de configurações críticas

## 🆘 Incident Response

**Plano de ação**:
1. Detectar: Auditoria automática + alertas
2. Conter: Revogar chaves, invalidar sessões
3. Investigar: Consultar audit_log
4. Notificar: Avisar usuários (se necessário)
5. Remediar: Patches, resets
6. Revisar: Pós-incident

---

Mantenha este documento atualizado conforme mudanças legislativas!
