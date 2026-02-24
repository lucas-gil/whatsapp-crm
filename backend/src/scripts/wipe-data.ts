import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const argv = process.argv.slice(2);
  const flags: Record<string, any> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.split('=') : [a, 'true'];
    flags[k.replace(/^--/, '')] = v;
  }
  return flags;
}

async function wipeWorkspace(workspaceId: string) {
  console.log(`
🔴 Limpando dados do workspace: ${workspaceId}`);

  // Mensagens e anexos
  await prisma.messageLog.deleteMany({ where: { workspaceId } });
  await prisma.attachment.deleteMany({ where: { message: { workspaceId } } });
  await prisma.message.deleteMany({ where: { workspaceId } });

  // Conversas e grupos
  await prisma.conversation.deleteMany({ where: { workspaceId } });
  await prisma.group.deleteMany({ where: { workspaceId } });

  // Broadcasts / Polls
  await prisma.broadcastRecipient.deleteMany({ where: { workspaceId } });
  await prisma.broadcast.deleteMany({ where: { workspaceId } });

  await prisma.pollInteraction.deleteMany({ where: { workspaceId } });
  await prisma.pollRecipient.deleteMany({ where: { workspaceId } });
  await prisma.pollCampaign.deleteMany({ where: { workspaceId } });

  // Tags e templates
  await prisma.template.deleteMany({ where: { workspaceId } });
  await prisma.tag.deleteMany({ where: { workspaceId } });

  // Leads (contatos)
  await prisma.lead.deleteMany({ where: { workspaceId } });

  console.log(`✅ Workspace ${workspaceId} limpo`);
}

async function main() {
  const flags = parseArgs();

  if (!flags.confirm) {
    console.error('Parar: --confirm é necessário para executar a limpeza (ex: --all --confirm)');
    process.exit(1);
  }

  if (flags.all === 'true' || flags.all === true) {
    const workspaces = await prisma.workspace.findMany({ select: { id: true } });
    for (const ws of workspaces) {
      await wipeWorkspace(ws.id);
    }
    await prisma.$disconnect();
    console.log('\n🎉 Limpeza completa para todos workspaces');
    return;
  }

  if (flags.workspace) {
    // aceita id ou slug
    const ws = await prisma.workspace.findFirst({
      where: { OR: [{ id: flags.workspace }, { slug: flags.workspace }] },
      select: { id: true },
    });
    if (!ws) {
      console.error('Workspace não encontrado:', flags.workspace);
      process.exit(1);
    }
    await wipeWorkspace(ws.id);
    await prisma.$disconnect();
    console.log('\n🎉 Limpeza completa para workspace especificado');
    return;
  }

  console.error('Parar: use --all ou --workspace=<id|slug> junto com --confirm');
  await prisma.$disconnect();
  process.exit(1);
}

main().catch((e) => {
  console.error('Erro ao limpar dados:', e);
  prisma.$disconnect();
  process.exit(1);
});
