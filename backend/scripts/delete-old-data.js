// Script para limpar dados antigos (vencidos) de todos workspaces
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dateLimit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  for (const ws of workspaces) {
    const workspaceId = ws.id;
    await prisma.charge.deleteMany({ where: { workspaceId, dueDate: { lt: dateLimit } } });
    await prisma.billingClient.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.message.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.conversation.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.lead.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.broadcastRecipient.deleteMany({ where: { workspaceId, sentAt: { lt: dateLimit } } });
    await prisma.broadcast.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.pollRecipient.deleteMany({ where: { workspaceId, sentAt: { lt: dateLimit } } });
    await prisma.pollInteraction.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.pollCampaign.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.group.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.tag.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.product.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.inventoryItem.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.inventoryMovement.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.orderItem.deleteMany({ where: { workspaceId, createdAt: { lt: dateLimit } } });
    await prisma.order.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.delivery.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.template.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.whatsAppSettings.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.geminiSettings.deleteMany({ where: { workspaceId, updatedAt: { lt: dateLimit } } });
    await prisma.messageLog.deleteMany({ where: { workspaceId, sentAt: { lt: dateLimit } } });
    console.log(`Dados antigos limpos para workspace: ${workspaceId}`);
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Erro ao limpar dados antigos:', e);
  process.exit(1);
});
