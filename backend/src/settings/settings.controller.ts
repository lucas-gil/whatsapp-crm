import { Controller, Get, Post, Body, Request, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get(':category')
  async getCategory(@Param('category') category: string, @Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const licenseKeyId = req.user.licenseKeyId;
    return { data: await this.settingsService.getCategory(workspaceId, licenseKeyId, category) };
  }

  @Post(':category')
  async updateCategory(@Param('category') category: string, @Body() body: any, @Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const licenseKeyId = req.user.licenseKeyId;
    const data = body.data ?? body;
    return { data: await this.settingsService.updateCategory(workspaceId, category, data, licenseKeyId) };
  }
}
