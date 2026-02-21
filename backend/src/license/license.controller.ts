import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Request,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';

@UseGuards(JwtAuthGuard)
@Controller('licenses')
export class LicenseController {
  constructor(private licenseService: LicenseService) {}

  @Post()
  async createLicense(@Body() dto: CreateLicenseDto, @Request() req: any) {
    // Verificar autenticação e permissão de admin
    if (!req.user || !req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode criar chaves');
    }

    return this.licenseService.createLicense(req.user.workspaceId, dto);
  }

  @Get()
  async listLicenses(@Request() req: any) {
    // Verificar autenticação e permissão de admin
    if (!req.user || !req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode listar chaves');
    }

    return this.licenseService.listLicenses(req.user.workspaceId);
  }

  @Delete(':id')
  async revokeLicense(@Param('id') id: string, @Request() req: any) {
    if (!req.user || !req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode revogar chaves');
    }

    return this.licenseService.revokeLicense(req.user.workspaceId, id);
  }
}
