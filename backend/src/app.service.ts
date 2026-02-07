import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getAdminKeyDebug() {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug: 'default' },
      });

      if (!workspace) {
        return { error: 'Workspace não encontrado' };
      }

      const adminKey = await this.prisma.licenseKey.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });

      if (!adminKey) {
        return {
          workspace: { id: workspace.id, slug: workspace.slug },
          adminKey: null,
          error: 'Chave ADMIN_INFINITE não encontrada no banco'
        };
      }

      // Verificar expiração
      const now = new Date();
      const isExpired = adminKey.expiresAt && now > adminKey.expiresAt;

      return {
        workspace: { id: workspace.id, slug: workspace.slug },
        adminKey: {
          id: adminKey.id,
          keyPreview: adminKey.keyPreview,
          type: adminKey.type,
          createdAt: adminKey.createdAt,
          expiresAt: adminKey.expiresAt,
          isExpired: isExpired,
          revokedAt: adminKey.revokedAt,
          isRevoked: !!adminKey.revokedAt,
          activatedAt: adminKey.activatedAt,
        },
        testInfo: {
          envADMIN_KEY: process.env.ADMIN_KEY || 'NÃO DEFINIDA',
          message: 'Use a chave acima para fazer login'
        }
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  async testAdminKeyBcrypt() {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug: 'default' },
      });

      if (!workspace) {
        return { error: 'Workspace não encontrado' };
      }

      const adminKeyFromEnv = process.env.ADMIN_KEY || 'NÃO DEFINIDA';
      const licenseKey = await this.prisma.licenseKey.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });

      if (!licenseKey) {
        return {
          error: 'Chave ADMIN_INFINITE não encontrada no banco',
          envKey: adminKeyFromEnv,
          bankKey: null
        };
      }

      // Testar se o hash bcrypt está correto
      const isValid = await bcrypt.compare(adminKeyFromEnv, licenseKey.keyHash);

      return {
        success: true,
        test: {
          envKey: adminKeyFromEnv,
          keyPreview: licenseKey.keyPreview,
          hashMatches: isValid,
          hashFromDatabase: licenseKey.keyHash.substring(0, 20) + '...',
        },
        bancData: {
          id: licenseKey.id,
          type: licenseKey.type,
          expiresAt: licenseKey.expiresAt,
          revokedAt: licenseKey.revokedAt,
          createdAt: licenseKey.createdAt,
        },
        result: isValid ? '✅ CHAVE VÁLIDA - Aceita pelo bcrypt' : '❌ CHAVE INVÁLIDA - Não corresponde ao hash'
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  async resetAdminKey() {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug: 'default' },
      });

      if (!workspace) {
        return { error: 'Workspace não encontrado' };
      }

      // Deletar chaves admin anteriores
      await this.prisma.licenseKey.deleteMany({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });

      // Gerar nova chave
      const adminKey = nanoid(32);
      const adminKeyHash = await bcrypt.hash(adminKey, 12);
      const adminKeyPreview = `${adminKey.slice(0, 8)}****${adminKey.slice(-4)}`;

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
        adminKey,
        preview: adminKeyPreview,
        message: '✅ Nova chave ADMIN gerada com sucesso! Salve em local seguro.',
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }
}
