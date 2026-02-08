import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');

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
    const adminKey = 'admin123456789admin123456789admin1';
    const adminKeyHash = await bcrypt.hash(adminKey, 12);
    const adminKeyPreview = `${adminKey.substring(0, 8)}...${adminKey.substring(adminKey.length - 4)}`;

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

    // 4. Criar Gemini settings
    await prisma.geminiSettings.upsert({
      where: { workspaceId: workspace.id },
      update: {},
      create: {
        workspaceId: workspace.id,
        isEnabled: false,
        systemPrompt: 'Você é um assistente atencioso e profissional.',
      },
    });

    console.log('✅ Configurações Gemini criadas');
    console.log('\n✨ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
