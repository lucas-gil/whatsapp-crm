import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getCategory(workspaceId: string, licenseKeyId: string | undefined, category: string) {
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
