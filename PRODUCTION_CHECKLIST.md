# 📋 PRODUCTION CHECKLIST

Use este checklist antes de subir a produção.

## 🔐 Segurança

- [ ] JWT_SECRET é uma string de 32+ caracteres aleatória
  ```bash
  openssl rand -hex 32
  ```

- [ ] DATABASE_URL usa PostgreSQL com SSL em produção
  - [ ] `sslmode=require` adicionado
  - [ ] Backup automático configurado

- [ ] CORS_ORIGIN aponta apenas para seu domínio
  - [ ] Não é "*" (wildcard)
  - [ ] HTTPS ativado

- [ ] Senhas do PostgreSQL e Redis são fortes
  - [ ] Min 20 caracteres
  - [ ] Mix de letras, números, símbolos

- [ ] Chaves de API (Gemini, S3, etc) são secrets
  - [ ] Nunca em .env de produção
  - [ ] Usar vault ou secrets manager

- [ ] Firewall está restritivo
  - [ ] Porta SSH (22) - IP whitelist
  - [ ] Porta HTTP (80) - aberto
  - [ ] Porta HTTPS (443) - aberto
  - [ ] 3000, 5432, 6379 - fechado (apenas interno)

- [ ] HTTPS/SSL funciona
  - [ ] Certificado válido (não auto-signed)
  - [ ] Renovação automática via Let's Encrypt

- [ ] Backup testado e funcionando
  - [ ] PostgreSQL backup diário
  - [ ] Armazenado em local seguro (S3, outro servidor)
  - [ ] Restore testado

## 🚀 Performance

- [ ] NODE_ENV=production no backend
- [ ] NODE_ENV=production no frontend
- [ ] Redis está rodando sem erro
- [ ] PostgreSQL tem índices em:
  - [ ] `leads.workspace_id`
  - [ ] `conversations.lead_id`
  - [ ] `messages.conversation_id`
  - [ ] `license_key.key_hash`

- [ ] Rate limiting configurado
  ```
  MESSAGES_PER_MINUTE=20 (ou mais conforme carga)
  ```

- [ ] Cache headers no frontend
  - [ ] Static assets com 1 ano
  - [ ] Dynamic com 5 minutos

- [ ] Cloudflare/CDN ativado (opcional)
  - [ ] Cache de static
  - [ ] DDoS protection

## 📊 Monitoramento

- [ ] Health checks respondendo
  - [ ] `GET http://seu-dominio/health` → 200 OK
  - [ ] `GET http://seu-dominio/version` → JSON com versão

- [ ] Logs centralizados
  - [ ] Backend logs em `/var/log/whatsapp-crm/`
  - [ ] Rotation diário (não ficar 1TB)

- [ ] Alertas configurados
  - [ ] CPU > 80%
  - [ ] Memória > 90%
  - [ ] Disco > 85%
  - [ ] Erro rate > 5%

- [ ] Monitoramento de uptime (opcional)
  - [ ] UptimeRobot
  - [ ] Datadog
  - [ ] New Relic

## 🔄 Deployment

- [ ] Processo de deploy documentado
  - [ ] Checklist de steps
  - [ ] Runbook de rollback

- [ ] Zero-downtime deploy possível
  - [ ] Blue-green ou canary

- [ ] Versioning de imagens Docker
  - [ ] Tags: v1.0.0, v1.0.1, etc
  - [ ] Nunca usar "latest"

- [ ] Migrations automáticas
  - [ ] `npm run db:migrate` roda no startup

- [ ] Seed testado
  - [ ] `npm run db:seed` cria dados iniciais corretos

## 📱 Frontend

- [ ] Build otimizado (next build)
- [ ] Imagens otimizadas (WebP, lazy loading)
- [ ] PWA manifest configurado (opcional)
- [ ] Favicon presente
- [ ] Meta tags preenchidas (title, description)

## 🔌 API

- [ ] Rate limiting por IP
  - [ ] 100 req/min para endpoints públicos
  - [ ] 1000 req/min para autenticado

- [ ] Validação de entrada rigorosa
  - [ ] Tipos do TypeScript
  - [ ] Class-validator em DTOs
  - [ ] Limpar SQL injection

- [ ] Paginação em GET /crm/leads, /crm/conversations
  - [ ] Max 100 itens por página
  - [ ] Offset padrão 0, limit padrão 50

## 🗄️ Database

- [ ] Backup policy clara
  ```
  - Daily full backup
  - Weekly to external storage
  - Monthly archive to cold storage
  ```

- [ ] Retention policy implementada
  ```
  - Leads: 5 anos
  - Messages: 2 anos
  - Audit logs: 1 ano
  - Sessions: 30 dias
  ```

- [ ] Replicação/HA configurada (se múltiplos servidores)

- [ ] Vacuum schedule ativado
  ```
  VACUUM ANALYZE; # diariamente
  ```

## 👥 Usuários & Acesso

- [ ] Admin inicial criado via seed
  - [ ] Chave armazenada com segurança
  - [ ] Compartilhada apenas com admin

- [ ] Documentação de como gerar chaves
  - [ ] Publicada para usuários internos

- [ ] 2FA para admin (futuro)

- [ ] Acesso SSH apenas com chave (não senha)
  - [ ] disable PasswordAuthentication
  - [ ] disable PermitRootLogin

## 📋 Compliance

- [ ] LGPD compliance check
  - [ ] Opt-in/opt-out implementado
  - [ ] Auditoria de ações
  - [ ] Termos de privacidade publicados

- [ ] Dados sensíveis não em logs
  - [ ] API Keys mascaradas
  - [ ] Senhas não aparecem

- [ ] GDPR se aplicável (EU)
  - [ ] CCPA se California

## 🧪 Testes

- [ ] Manual smoke test
  - [ ] [ ] Login com chave
  - [ ] [ ] Conectar WhatsApp (QR)
  - [ ] [ ] Enviar mensagem
  - [ ] [ ] Receber mensagem
  - [ ] [ ] Criar lead
  - [ ] [ ] Disparar broadcast
  - [ ] [ ] Testar Gemini (se ativado)
  - [ ] [ ] Admin dashboard acessível

- [ ] Load test (opcional)
  - [ ] 100 msgs/seg sustained
  - [ ] 10k leads carregando

- [ ] Failover test
  - [ ] Database down → recovery
  - [ ] Redis down → recovery
  - [ ] Backend down → frontend error handling

## 📞 Suporte & Documentação

- [ ] README.md em produção
- [ ] DEPLOYMENT.md atualizado com seu ambiente
- [ ] TROUBLESHOOTING.md com dados reais
- [ ] Runbook de operações
- [ ] Contatos de suporte definidos

## 🎯 Pós-Deploy

### Primeiras 24h

- [ ] Monitorar logs para erros
- [ ] Testar todos os fluxos principais
- [ ] Verificar performance (CPU, memory, queries lentas)
- [ ] Testar acesso de diferentes IPs/browsers

### Primeiros 7 dias

- [ ] Backups rodando corretamente
- [ ] Alertas funcionando
- [ ] Usuários conseguem fazer login
- [ ] Nenhum erro crítico em produção
- [ ] Performance aceitável

### Próximas semanas

- [ ] Documentar issues encontradas
- [ ] Planejar melhorias
- [ ] Escalar infraestrutura se necessário
- [ ] Rever logs de erro

---

**Versão**: 1.0.0
**Última atualização**: Fevereiro 2025
**Status**: Ready for Production ✅

Boa sorte no deploy! 🚀
