import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseDto, LicenseTypeEnum } from './dto/create-license.dto';
import { HashUtil } from '../common/utils/hash.util';
import { Logger } from '../common/utils/logger.util';
import { nanoid } from 'nanoid';

@Injectable()
export class LicenseService {
  private logger = new Logger('LicenseService');

  constructor(private prisma: PrismaService) {}

  async createLicense(workspaceId: string, dto: CreateLicenseDto) {
    // Gerar chave única (32 caracteres)
    const key = nanoid(32);
    const keyHash = await HashUtil.hash(key);
    const keyPreview = HashUtil.generateKeyPreview(key);

    // Não definir expiresAt aqui — a expiração deverá começar quando a chave for ativada (primeiro uso).
    // Em vez disso, armazenamos o ttl (em segundos) nas opções da chave para aplicar na ativação.
    let expiresAt: Date | null = null;
    const options = { ...(dto.options || {}) } as any;
    if (dto.type === LicenseTypeEnum.TEMPORARY_12MIN) {
      if (dto.ttlSeconds && dto.ttlSeconds > 0) options.ttlSeconds = dto.ttlSeconds;
      else options.ttlSeconds = 12 * 60; // 12 minutos
    } else if (dto.type === LicenseTypeEnum.TEMPORARY_30DAYS) {
      if (dto.ttlSeconds && dto.ttlSeconds > 0) options.ttlSeconds = dto.ttlSeconds;
      else options.ttlSeconds = 30 * 24 * 60 * 60; // 30 dias
    } else {
      // ADMIN_INFINITE: não tem ttl
    }

    const license = await this.prisma.licenseKey.create({
      data: {
        workspaceId,
        keyHash,
        keyPreview,
        type: dto.type as any,
        // expiresAt intencionalmente null for temporary keys — will be set on first activation
        expiresAt,
        options: Object.keys(options).length ? options : undefined,
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
