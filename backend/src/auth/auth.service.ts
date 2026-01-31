import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { HashUtil } from '../common/utils/hash.util';
import { Logger } from '../common/utils/logger.util';

@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    if (!dto.key) {
      throw new BadRequestException('Chave de acesso obrigatória');
    }

    // Buscar workspace (padrão ou pelo slug)
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        slug: dto.workspaceSlug || 'default',
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace não encontrado');
    }

    // Buscar todas as chaves ativas dessa workspace (não revogadas, não expiradas)
    const licenseKeys = await this.prisma.licenseKey.findMany({
      where: {
        workspaceId: workspace.id,
        revokedAt: null,
      },
    });

    if (licenseKeys.length === 0) {
      throw new UnauthorizedException('Nenhuma chave válida encontrada');
    }

    // Verificar qual chave corresponde
    let validKey: any = null;
    for (const keyRecord of licenseKeys) {
      const isMatch = await HashUtil.compare(dto.key, keyRecord.keyHash);
      if (isMatch) {
        validKey = keyRecord;
        break;
      }
    }

    if (!validKey) {
      throw new UnauthorizedException('Chave inválida');
    }

    // Verificar expiração
    if (validKey.expiresAt && new Date() > validKey.expiresAt) {
      throw new UnauthorizedException('Chave expirada');
    }

    // Determinar se é admin
    const isAdmin = validKey.type === 'ADMIN_INFINITE';

    // Marcar primeira ativação se necessário
    if (!validKey.activatedAt) {
      await this.prisma.licenseKey.update({
        where: { id: validKey.id },
        data: { activatedAt: new Date() },
      });
    }

    // Atualizar última utilização
    await this.prisma.licenseKey.update({
      where: { id: validKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Gerar JWT
    const jwtExpiry = this.configService.get('JWT_EXPIRY', '24h');
    const jwtToken = this.jwtService.sign(
      {
        sub: validKey.id,
        workspaceId: workspace.id,
        licenseKeyId: validKey.id,
        isAdmin,
      },
      { expiresIn: jwtExpiry },
    );

    // Criar sessão
    const jwtExpiresAt = new Date();
    jwtExpiresAt.setHours(jwtExpiresAt.getHours() + 24);

    const session = await this.prisma.userSession.create({
      data: {
        workspaceId: workspace.id,
        licenseKeyId: validKey.id,
        jwtToken,
        jwtExpiresAt,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });

    // Log de auditoria
    await this.prisma.auditLog.create({
      data: {
        licenseKeyId: validKey.id,
        action: 'LOGIN',
        ipAddress,
        userAgent,
      },
    });

    this.logger.info(
      `Login bem-sucedido - Workspace: ${workspace.slug}, Admin: ${isAdmin}`,
    );

    return {
      accessToken: jwtToken,
      tokenType: 'Bearer',
      expiresIn: 86400, // 24 horas em segundos
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      isAdmin,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  async logout(licenseKeyId: string) {
    // Invalidar sessões dessa chave
    await this.prisma.userSession.updateMany({
      where: { licenseKeyId },
      data: { expiresAt: new Date() },
    });

    // Log auditoria
    await this.prisma.auditLog.create({
      data: {
        licenseKeyId,
        action: 'LOGOUT',
      },
    });

    this.logger.info(`Logout - Chave: ${licenseKeyId}`);
  }
}
