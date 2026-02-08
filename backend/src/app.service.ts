import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminPassword() {
    return {
      password: 'senha123',
      message: 'Use esta senha para fazer login',
    };
  }

  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  version() {
    return {
      version: '1.0.0',
      name: 'WhatsAppCRM',
    };
  }

  async forceResetAdmin() {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug: 'default' },
      });

      if (!workspace) {
        return { error: 'Workspace não encontrado' };
      }

      // Deletar antigas
      await this.prisma.licenseKey.deleteMany({
        where: { workspaceId: workspace.id },
      });

      // Criar nova com senha simples
      await this.prisma.licenseKey.create({
        data: {
          workspaceId: workspace.id,
          keyHash: 'senha123',
          keyPreview: 'senha123',
          type: 'ADMIN_INFINITE',
          expiresAt: null,
          revokedAt: null,
        },
      });

      return {
        success: true,
        password: 'senha123',
        message: '✅ Chave admin resetada! Senha: senha123',
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }
}
