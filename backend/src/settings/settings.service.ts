import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getCategory(workspaceId: string, licenseKeyId: string | undefined, category: string) {
    if (category === 'gemini') {
      const gemini = await this.prisma.geminiSettings.findUnique({ where: { workspaceId } });
      if (!gemini) return null;
      return {
        apiKey: gemini.apiKey,
        systemPrompt: gemini.systemPrompt,
        isEnabled: gemini.isEnabled,
      };
    }
    if (licenseKeyId) {
      const license = await this.prisma.licenseKey.findUnique({ where: { id: licenseKeyId } });
      if (!license) throw new NotFoundException('LicenseKey not found');
      const options = (license.options || {}) as any;
      return options[category] ?? null;
    }
    // no licenseKeyId -> no per-user settings available
    return null;
  }

  async updateCategory(
    workspaceId: string,
    category: string,
    data: any,
    licenseKeyId?: string,
  ) {
    if (category === 'gemini') {
      const gemini = await this.prisma.geminiSettings.findUnique({ where: { workspaceId } });
      if (!gemini) throw new NotFoundException('Gemini settings not found');
      const updated = await this.prisma.geminiSettings.update({
        where: { workspaceId },
        data: {
          apiKey: data.apiKey ?? gemini.apiKey,
          systemPrompt: data.systemPrompt ?? gemini.systemPrompt,
          isEnabled: typeof data.isEnabled === 'boolean' ? data.isEnabled : gemini.isEnabled,
        },
      });
      return {
        apiKey: updated.apiKey,
        systemPrompt: updated.systemPrompt,
        isEnabled: updated.isEnabled,
      };
    }
    if (!licenseKeyId) throw new NotFoundException('LicenseKey required');
    const license = await this.prisma.licenseKey.findUnique({ where: { id: licenseKeyId } });
    if (!license) throw new NotFoundException('LicenseKey not found');
    const options = (license.options || {}) as any;
    options[category] = data;
    await this.prisma.licenseKey.update({
      where: { id: licenseKeyId },
      data: { options },
    });
    return options[category];
  }
}
