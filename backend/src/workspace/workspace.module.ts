import { Module, Injectable } from '@nestjs/common';
import { PrismaModule } from '@prisma/prisma.module';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async createDefaultWorkspace() {
    const existing = await this.prisma.workspace.findUnique({
      where: { slug: 'default' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.workspace.create({
      data: {
        name: 'Default Workspace',
        slug: 'default',
      },
    });
  }

  async getWorkspace(slug: string) {
    return this.prisma.workspace.findUnique({
      where: { slug },
    });
  }
}

@Module({
  imports: [PrismaModule],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
