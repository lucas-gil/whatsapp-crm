import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { HashUtil } from '../common/utils/hash.util';
import { Logger } from '../common/utils/logger.util';
import { nanoid } from 'nanoid';
import { LicenseType } from '@prisma/client';

@Injectable()
export class LicenseService {
  private logger = new Logger('LicenseService');

  constructor(private prisma: PrismaService) {}

  async createLicense(workspaceId: string, dto: CreateLicenseDto) {
    // Gerar chave única (32 caracteres)
    const key = nanoid(32);
    const keyHash = await HashUtil.hash(key);
    const keyPreview = HashUtil.generateKeyPreview(key);

    // Calcular data de expiração
    let expiresAt: Date | null = null;
    if (dto.type === LicenseType.TEMPORARY_12MIN) {
      expiresAt = new Date(Date.now() + 12 * 60 * 1000); // 12 minutos
    } else if (dto.type === LicenseType.TEMPORARY_30DAYS) {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
    }
    // ADMIN_INFINITE: expiresAt = null

    const license = await this.prisma.licenseKey.create({
      data: {
        workspaceId,
        keyHash,
        keyPreview,
        type: dto.type,
        expiresAt,
      },
    });

    this.logger.info(
      `Nova chave criada: ${keyPreview} (${dto.type})`,
    );

    // Retornar a chave UMA VEZ (não será recuperável depois)
    return {
      id: license.id,
      key, // ⚠️ UMA VEZ APENAS
      keyPreview: license.keyPreview,
      type: license.type,
      expiresAt: license.expiresAt,
      createdAt: license.createdAt,
    };
  }

  async listLicenses(workspaceId: string) {
    const licenses = await this.prisma.licenseKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        keyPreview: true,
        type: true,
        expiresAt: true,
        activatedAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return licenses;
  }

  async revokeLicense(workspaceId: string, licenseId: string) {
    const license = await this.prisma.licenseKey.findFirst({
      where: { id: licenseId, workspaceId },
    });

    if (!license) {
      throw new Error('Chave não encontrada');
    }

    await this.prisma.licenseKey.update({
      where: { id: licenseId },
      data: { revokedAt: new Date() },
    });

    // Invalidar todas as sessões dessa chave
    await this.prisma.userSession.updateMany({
      where: { licenseKeyId: licenseId },
      data: { expiresAt: new Date() },
    });

    this.logger.info(`Chave revogada: ${license.keyPreview}`);

    return { message: 'Chave revogada com sucesso' };
  }

  async validateLicense(key: string) {
    // Buscar todas as chaves (precisa verificar cada uma contra o hash)
    const licenseKeys = await this.prisma.licenseKey.findMany({
      where: { revokedAt: null },
    });

    for (const keyRecord of licenseKeys) {
      const isMatch = await HashUtil.compare(key, keyRecord.keyHash);
      if (isMatch) {
        // Verificar expiração
        if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
          return { valid: false, reason: 'expired' };
        }
        return { valid: true, license: keyRecord };
      }
    }

    return { valid: false, reason: 'invalid' };
  }
}
