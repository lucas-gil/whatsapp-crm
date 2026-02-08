import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';
import { Logger } from '../common/utils/logger.util';

@Controller('auth')
export class AuthController {
  private logger = new Logger('AuthController');

  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Request() req: ExpressRequest) {
    this.logger.info(`📥 POST /auth/login recebido`);
    this.logger.info(`   Chave fornecida: ${dto.key ? dto.key.substring(0, 8) + '...' : 'VAZIO'}`);
    this.logger.info(`   IP: ${req.ip}`);
    
    const ipAddress =
      req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    const result = await this.authService.login(dto, ipAddress, userAgent);
    this.logger.info(`✅ Login retornando accessToken com sucesso`);
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: ExpressRequest) {
    this.logger.info(`📥 POST /auth/logout recebido`);
    await this.authService.logout((req.user as any).licenseKeyId);
    this.logger.info(`✅ Logout realizado`);
    return { message: 'Logout realizado com sucesso' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req: ExpressRequest) {
    this.logger.info(`📥 GET /auth/me recebido`);
    this.logger.info(`   User: ${JSON.stringify(req.user)}`);
    return req.user;
  }
}
