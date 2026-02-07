import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

class HashUtil {
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static generateKeyPreview(key: string): string {
    return `${key.slice(0, 8)}****${key.slice(-4)}`;
  }
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // 1. Criar workspace padrão
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Workspace',
      slug: 'default',
    },
  });

  console.log(`✅ Workspace criado: ${workspace.id}`);

  // 2. Criar chave ADMIN
  // Usar chave do env se definida, senão gerar aleatória
  const adminKey = process.env.ADMIN_KEY || nanoid(32);
  const adminKeyHash = await HashUtil.hash(adminKey);
  const adminKeyPreview = HashUtil.generateKeyPreview(adminKey);

  // Deletar chave admin anterior se existir
  await prisma.licenseKey.deleteMany({
    where: {
      workspaceId: workspace.id,
      type: 'ADMIN_INFINITE',
    },
  });

  const adminLicense = await prisma.licenseKey.create({
    data: {
      workspaceId: workspace.id,
      keyHash: adminKeyHash,
      keyPreview: adminKeyPreview,
      type: 'ADMIN_INFINITE',
    },
  });

  console.log(`✅ Chave ADMIN criada: ${adminKeyPreview}`);
  console.log(`🔑 CHAVE COMPLETA (salve em local seguro): ${adminKey}`);
  
  if (process.env.ADMIN_KEY) {
    console.log('⚠️  USANDO CHAVE DO ARQUIVO .env - Não é aleatória!');
  } else {
    console.log('ℹ️  Chave gerada aleatoriamente - defina ADMIN_KEY no .env para usar uma chave customizada');
  }

  // 3. Criar algumas tags padrão
  const tags = ['Novo', 'Qualificado', 'Proposta', 'Cliente', 'Perdido'];
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: tagName } },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: tagName,
        color: '#007AFF',
      },
    });
  }

  console.log(`✅ ${tags.length} tags padrão criadas`);

  // 4. Criar template padrão
  await prisma.template.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Saudação' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'Saudação',
      category: 'mensagem',
      content: 'Olá {{nome}}! Bem-vindo ao nosso serviço. Como posso ajudá-lo?',
      variables: ['nome'],
      isActive: true,
    },
  });

  console.log('✅ Template padrão criado');

  // 5. Criar Gemini settings (desabilitado por padrão)
  await prisma.geminiSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      isEnabled: false,
      systemPrompt: 'Você é um assistente atencioso e profissional.',
    },
  });

  console.log('✅ Configurações Gemini criadas (desabilitadas)');

  console.log('\n✨ Seed concluído com sucesso!');
  console.log('\n📝 Dados importantes:');
  console.log(`   - Workspace ID: ${workspace.id}`);
  console.log(`   - Chave Admin: ${adminKey}`);
  console.log(`   - Preview: ${adminKeyPreview}`);
  console.log('\n🔐 GUARDE A CHAVE COM SEGURANÇA!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
