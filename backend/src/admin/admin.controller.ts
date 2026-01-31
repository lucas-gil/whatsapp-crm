import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from './guards/admin.guard';

interface AuthRequest {
  user: {
    isAdmin: boolean;
    workspaceId: string;
    id: string;
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('audit-logs')
  async getAuditLogs(@Request() req: AuthRequest) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.adminService.getAuditLogs(req.user.workspaceId);
  }

  @Get('sessions')
  async getSessions(@Request() req: AuthRequest) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.adminService.getUserSessions(req.user.workspaceId);
  }

  @Get('stats')
  async getStats(@Request() req: AuthRequest) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.adminService.getWorkspaceStats(req.user.workspaceId);
  }

  @Delete('sessions/:id')
  async invalidateSession(@Param('id') id: string, @Request() req: AuthRequest) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.adminService.invalidateSession(id);
  }
}
