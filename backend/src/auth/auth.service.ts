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

    // Remover espaços extras da chave
    const cleanKey = dto.key.trim();

    this.logger.info(`🔐 Login iniciado com chave: ${cleanKey.substring(0, 8)}...`);

    // Buscar workspace
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        slug: dto.workspaceSlug || 'default',
      },
    });

    if (!workspace) {
      this.logger.error(`❌ Workspace não encontrado: ${dto.workspaceSlug || 'default'}`);
      throw new NotFoundException('Workspace não encontrado');
    }

    this.logger.info(`✅ Workspace encontrado: ${workspace.id}`);

    // Buscar a chave ADMIN
    const licenseKey = await this.prisma.licenseKey.findFirst({
      where: {
        workspaceId: workspace.id,
        type: 'ADMIN_INFINITE',
        revokedAt: null,
      },
    });

    if (!licenseKey) {
      this.logger.error(`❌ Nenhuma chave ADMIN_INFINITE encontrada no workspace ${workspace.id}`);
      throw new UnauthorizedException('Nenhuma chave admin encontrada');
    }

    this.logger.info(`✅ Chave encontrada: ${licenseKey.keyPreview}, Hash: ${licenseKey.keyHash.substring(0, 30)}...`);

    // Comparar a chave com o hash usando bcrypt
    this.logger.info(`🔍 Comparando chave fornecida com hash armazenado...`);
    const isKeyValid = await HashUtil.compare(cleanKey, licenseKey.keyHash);
    
    if (!isKeyValid) {
      this.logger.error(`❌ Chave inválida! Fornecida: ${cleanKey.substring(0, 8)}..., Hash: ${licenseKey.keyHash.substring(0, 30)}...`);
      throw new UnauthorizedException('Chave inválida');
    }

    this.logger.info(`✅ Chave validada com sucesso!`);

    // Verificar expiração
    if (licenseKey.expiresAt && new Date() > licenseKey.expiresAt) {
      this.logger.error(`❌ Chave expirada: ${licenseKey.expiresAt}`);
      throw new UnauthorizedException('Chave expirada');
    }

    // Marcar primeira ativação se necessário
    if (!licenseKey.activatedAt) {
      await this.prisma.licenseKey.update({
        where: { id: licenseKey.id },
        data: { activatedAt: new Date() },
      });
      this.logger.info(`✅ Primeira ativação marcada`);
    }

    // Atualizar última utilização
    await this.prisma.licenseKey.update({
      where: { id: licenseKey.id },
      data: { lastUsedAt: new Date() },
    });
    this.logger.info(`✅ Última utilização atualizada`);

    // Gerar JWT
    const jwtExpiry = this.configService.get('JWT_EXPIRY', '24h');
    const jwtToken = this.jwtService.sign(
      {
        sub: licenseKey.id,
        workspaceId: workspace.id,
        licenseKeyId: licenseKey.id,
        isAdmin: true,
      },
      { expiresIn: jwtExpiry },
    );

    this.logger.info(`✅ JWT gerado: ${jwtToken.substring(0, 50)}...`);

    // Criar sessão
    const jwtExpiresAt = new Date();
    jwtExpiresAt.setHours(jwtExpiresAt.getHours() + 24);

    const session = await this.prisma.userSession.create({
      data: {
        workspaceId: workspace.id,
        licenseKeyId: licenseKey.id,
        jwtToken,
        jwtExpiresAt,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.info(`✅ Sessão criada: ${session.id}`);
    this.logger.info(`✅ Login bem-sucedido para ${ipAddress}`);

    return {
      accessToken: jwtToken,
      tokenType: 'Bearer',
      expiresIn: 86400,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      isAdmin: true,
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
