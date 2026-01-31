import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { JwtAuthGuard } from '@auth/jwt.guard';

@Controller('licenses')
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private licenseService: LicenseService) {}

  @Post()
  async createLicense(@Body() dto: CreateLicenseDto, @Request() req) {
    // Apenas admin pode criar chaves
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode criar chaves');
    }

    return this.licenseService.createLicense(req.user.workspaceId, dto);
  }

  @Get()
  async listLicenses(@Request() req) {
    // Apenas admin pode listar
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode listar chaves');
    }

    return this.licenseService.listLicenses(req.user.workspaceId);
  }

  @Delete(':id')
  async revokeLicense(@Param('id') id: string, @Request() req) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Apenas admin pode revogar chaves');
    }

    return this.licenseService.revokeLicense(req.user.workspaceId, id);
  }
}
