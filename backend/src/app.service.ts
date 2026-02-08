import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AppService {
  private readonly ADMIN_KEY = 'admin123456789admin123456789admin1';

  constructor(private readonly prisma: PrismaService) {}

  async getAdminPassword() {
    return {
      key: this.ADMIN_KEY,
      message: `🔑 Chave admin: ${this.ADMIN_KEY.substring(0, 8)}...${this.ADMIN_KEY.substring(this.ADMIN_KEY.length - 4)}`,
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

      // Hash da chave admin com bcrypt
      const adminKeyHash = await bcrypt.hash(this.ADMIN_KEY, 12);
      const adminKeyPreview = `${this.ADMIN_KEY.substring(0, 8)}...${this.ADMIN_KEY.substring(this.ADMIN_KEY.length - 4)}`;

      // Deletar antiga
      await this.prisma.licenseKey.deleteMany({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });

      // Criar nova com hash bcrypt correto
      await this.prisma.licenseKey.create({
        data: {
          workspaceId: workspace.id,
          keyHash: adminKeyHash,
          keyPreview: adminKeyPreview,
          type: 'ADMIN_INFINITE',
          expiresAt: null,
          revokedAt: null,
        },
      });

      return {
        success: true,
        key: this.ADMIN_KEY,
        preview: adminKeyPreview,
        message: `✅ Chave admin resetada! Use: ${this.ADMIN_KEY}`,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  async debugCheckHash() {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug: 'default' },
      });

      if (!workspace) {
        return { error: 'Workspace não encontrado' };
      }

      const licenseKey = await this.prisma.licenseKey.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });

      if (!licenseKey) {
        return { error: 'Chave admin não encontrada no banco' };
      }

      // Testar comparação do bcrypt
      const test1 = await bcrypt.compare(this.ADMIN_KEY, licenseKey.keyHash);
      const test2 = await bcrypt.compare(this.ADMIN_KEY.trim(), licenseKey.keyHash);
      const test3 = await bcrypt.compare(this.ADMIN_KEY.trim().toLowerCase(), licenseKey.keyHash);

      return {
        keyFound: true,
        storedKeyPreview: licenseKey.keyPreview,
        adminKeyLength: this.ADMIN_KEY.length,
        adminKeyFirst8: this.ADMIN_KEY.substring(0, 8),
        hashExists: !!licenseKey.keyHash,
        hashStartsWith: licenseKey.keyHash.substring(0, 30) + '...',
        tests: {
          directMatch: test1,
          withTrim: test2,
          withTrimAndLowercase: test3,
        },
        message: test1 ? '✅ Chave é válida!' : '❌ Falha na comparação - verifique o hash no banco',
        suggestion: test1 ? 'Hash está correto, problema pode estar no frontend ou rede' : 'Hash pode estar corrompido, tente resetar com /api/force-reset-admin',
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }
}
