import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function resetAdminKey() {
  console.log('🔄 Resetando chave ADMIN...\n');

  try {
    // Encontrar workspace padrão
    const workspace = await prisma.workspace.findFirst({
      where: { slug: 'default' },
    });

    if (!workspace) {
      console.error('❌ Workspace padrão não encontrado!');
      process.exit(1);
    }

    // Deletar chave admin anterior (se existir)
    await prisma.licenseKey.deleteMany({
      where: {
        workspaceId: workspace.id,
        type: 'ADMIN_INFINITE',
      },
    });

    // Gerar nova chave admin
    const adminKey = nanoid(32);
    const adminKeyHash = await bcrypt.hash(adminKey, 12);
    const adminKeyPreview = `${adminKey.slice(0, 8)}****${adminKey.slice(-4)}`;

    // Salvar no banco
    const newAdminKey = await prisma.licenseKey.create({
      data: {
        workspaceId: workspace.id,
        keyHash: adminKeyHash,
        keyPreview: adminKeyPreview,
        type: 'ADMIN_INFINITE',
      },
    });

    console.log('✅ Nova chave ADMIN criada com sucesso!\n');
    console.log('=' * 60);
    console.log('🔑 CHAVE ADMIN (COMPLETA) - SALVE EM LOCAL SEGURO:');
    console.log('=' * 60);
    console.log(adminKey);
    console.log('=' * 60);
    console.log(`\n📝 Preview: ${adminKeyPreview}`);
    console.log(`\n🌐 Login em: https://webot-app.4ziatk.easypanel.host/`);
    console.log('📊 Dashboard: https://webot-app.4ziatk.easypanel.host/dashboard');
    console.log('\n✨ Pronto! Use a chave acima para fazer login.\n');

  } catch (error) {
    console.error('❌ Erro ao resetar chave:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminKey();
