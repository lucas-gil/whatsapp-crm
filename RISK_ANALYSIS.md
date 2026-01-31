# ⚠️ PONTOS DE RISCO & LIMITAÇÕES

Documentar problemas conhecidos e limitações do sistema.

## 🚨 Riscos Críticos

### 1. Bloqueio por Automação (Provider WebQR)

**Risco**: WhatsApp pode bloquear conta que usa Baileys/WebQR

**Impacto**: Alta
- Perda total de conectividade
- Dados não sincronizados
- Downtime de até horas

**Mitigation**:
1. **Migrar para Cloud API quando viável**
   - Mais seguro e oficial
   - Sem risco de bloqueio

2. **Usar múltiplos números** se possível
   - Distribuir carga
   - Fallback automático

3. **Monitorar logs** para sinais de aviso
   - "Request was blocked"
   - "Logout" inesperado

4. **Rate limiting agressivo**
   - 10-20 msgs/min (não 100+)
   - Evitar padrões detectáveis

**Indicadores de Risco**:
```
❌ Múltiplos "checkpoint" requests
❌ "Please try again later"
❌ QR Code expirando rapidamente
❌ Session loss frequente
```

### 2. Performance em Escala

**Risco**: Banco fica lento com muitos leads/mensagens

**Impacto**: Média
- Dashboard demora para carregar
- API responde em 2s+
- Disparos atrasam

**Mitigation**:
1. Índices no PostgreSQL
   ```sql
   CREATE INDEX idx_leads_workspace_opt_in ON leads(workspace_id, opt_in);
   CREATE INDEX idx_messages_conversation_date ON messages(conversation_id, created_at DESC);
   ```

2. Particionamento de dados (postgres)
   ```sql
   -- Por workspace
   CREATE TABLE messages_2025 PARTITION OF messages
   FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
   ```

3. Soft delete ao invés de hard delete
   - Permite recuperação

4. Arquivar dados antigos
   - Mover para cold storage após 1 ano

### 3. Redis Memory Leak

**Risco**: Redis fica cheio de jobs antigos

**Impacto**: Média
- Redis começa a falhar
- Filas não processam
- Disparos travam

**Mitigation**:
1. Implementar job cleanup
   ```typescript
   // Remover jobs completos após 1 semana
   const job = queue.add(...);
   job.updateProgress(100);
   setTimeout(() => job.remove(), 7 * 24 * 3600 * 1000);
   ```

2. Redis persistence desabilitada por padrão
   - Redis restart = perda de jobs (aceitável)
   - Se precisa persistência, usar RDB/AOF com cuidado

3. Monitoramento de memory
   ```bash
   docker-compose exec redis redis-cli INFO memory
   ```

### 4. Gemini Rate Limit

**Risco**: Gemini pode rejeitar requisições se quota excedida

**Impacto**: Baixa (apenas respostas AI falham)
- Usuário recebe mensagem padrão
- Conversação não quebra

**Mitigation**:
1. Usar tier pago do Gemini
2. Implementar queue com delay entre requisições
3. Cache de respostas similares (futuro)
4. Fallback automático para template
   ```typescript
   const reply = await gemini.generateReply() || fallbackReply;
   ```

## ⚠️ Limitações Conhecidas

### 1. Sincronização de Grupos

**Limitação**: Grupos precisam ser sincronizados manualmente

**Por quê**: Baileys não sincroniza grupos em tempo real

**Workaround**:
1. API para listar grupos:
   ```bash
   GET /whatsapp/groups
   ```

2. Selecionar manual para enviar broadcast

3. **Futuro**: Implementar webhooks para novos grupos

### 2. Attachments Grandes

**Limitação**: WhatsApp limita tamanho de mídia

| Tipo | Max | Timeout |
|------|-----|---------|
| Imagem | 16MB | 30s |
| Vídeo | 100MB | 60s |
| Áudio | 100MB | 60s |
| Doc | 100MB | 60s |

**Workaround**:
1. Validação frontend + backend
2. Compressão automática de imagens
3. Converter vídeos para formato compatível

### 3. Limite de Mensagens por Conversa

**Limitação**: Paginação de 50 mensagens por default

**Por quê**: Performance com muitas mensagens

**Workaround**:
1. Aumentar limit com `?limit=100` (cuidado)
2. Usar filtros de data
3. Implementar virtual scrolling (frontend)

### 4. Timeouts de Conectividade

**Limitação**: QR Code expira após 15 segundos

**Por quê**: Segurança do WhatsApp

**Workaround**:
1. Renovar QR automaticamente
   ```typescript
   setInterval(() => generateQR(), 10000);
   ```

2. Avisar usuário para escanear rápido

### 5. Não Suporta Mensagens Criptografadas

**Limitação**: End-to-end encryption não está implementado

**Impact**: Baixo (WhatsApp já criptografa)

**Futuro**: Implementar se necessário

## 🔄 Provider Migration (WebQR → CloudAPI)

### Quando Migrar

Sinais que é hora:
- [ ] Mais de 100 disparos/dia
- [ ] Muitos bloqueios/checkpoints
- [ ] Produção crítica
- [ ] SLA > 99%

### Como Migrar

1. **Setup Cloud API** (dia 1-2)
   - Criar app em developers.facebook.com
   - Configurar números e webhooks
   - Gerar tokens

2. **Implementar novo provider** (dia 2-3)
   ```typescript
   // backend/src/whatsapp/providers/whatsapp-cloud-api.provider.ts
   // Completar implementação atual (stub)
   ```

3. **Teste em staging** (dia 3-4)
   - Enviar msgs teste
   - Receber msgs teste
   - Testar disparos

4. **Dual-write** (dia 5-6)
   - Ambos providers ativos
   - Rota de fallback: CloudAPI → WebQR
   - Log de qual foi usado

5. **Switch gradual** (dia 6-7)
   - 10% traffic → CloudAPI
   - Monitor erros
   - Aumentar 50%, 100%

6. **Sunset WebQR** (dia 8+)
   - Remover Baileys
   - Limpar sessões antigas
   - Deprecate endpoints

### Impacto de Downtime

- WebQR → CloudAPI: **nenhum** (sem reauth)
- CloudAPI perdeu token: ~ 5 min de espera

## 🔐 Segurança: Trade-offs

### JWT vs Session Cookies

**Escolha**: JWT Token

**Por quê**:
- ✅ Stateless (escalável)
- ✅ Mobile-friendly
- ❌ Não pode revogar instantaneamente

**Mitigation**: Session table com expiração curta (24h)

### Chaves em Hash vs Vault

**Escolha**: Hash no banco (bcrypt)

**Por quê**:
- ✅ Simples, não precisa de infraestrutura
- ❌ Menos seguro que vault

**Recomendação Produção**:
```bash
# Usar HashiCorp Vault ou AWS Secrets Manager
export VAULT_ADDR="https://vault.seu-dominio.com"
jwt=$(vault kv get -field=admin_key secret/whatsapp-crm)
```

## 💾 Data Loss Scenarios

### Cenário 1: PostgreSQL Corrompido

**Probabilidade**: Muito baixa (< 0.1%)

**Recovery**:
1. Restore do último backup
2. Perda: dados desde último backup
3. **Prevenção**: Daily backups + weekly off-site

### Cenário 2: Redis Perdido

**Probabilidade**: Média durante crashes

**Recovery**:
1. Filas perdidas
2. Jobs não processados
3. **Prevenção**: Re-enqueue no startup

### Cenário 3: Storage Local Perdido

**Probabilidade**: Se volume não mapeado

**Recovery**:
1. Mídia não recuperável
2. Banco tem referências quebradas
3. **Prevenção**: Usar S3 em produção

## 📊 Scalability Limits

| Métrica | Limite | Ação |
|---------|--------|------|
| Leads | 1M | Particionar DB |
| Msgs/seg | 100 | Add workers |
| Broadcasts/dia | 10 | Queue scaling |
| Concurrent users | 1k | Load balancer |
| Workspace storage | 1TB | Archive old |

## 🧩 Integrations (Futuro)

Recursos planejados mas não implementados:

- [ ] Payment gateway (Stripe)
- [ ] Email notifications
- [ ] SMS fallback
- [ ] Video chat
- [ ] Calendar integration
- [ ] CRM sync (Salesforce)
- [ ] Analytics dashboard
- [ ] Mobile app
- [ ] API webhooks

## 📞 Suporte & SLA

### Objetivos

| SLA | Implementado |
|-----|---|
| Uptime | 99% (sem garantia) |
| Response time | < 1s | 
| Disponibilidade API | 99% |
| Data backup | Diário |

### Não Incluído

- ❌ 24/7 support
- ❌ SLA formal
- ❌ Disaster recovery automático
- ❌ Load balancing automático

---

**Próximos passos**: Ver [DEPLOYMENT.md](DEPLOYMENT.md) para setup seguro em produção.
