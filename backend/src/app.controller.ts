import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  health() {
    return this.appService.health();
  }

  @Get('/version')
  version() {
    return this.appService.version();
  }

  @Post('/api/force-reset-admin')
  forceResetAdmin() {
    return this.appService.forceResetAdmin();
  }

  @Get('/api/debug/admin-password')
  getAdminPassword() {
    return this.appService.getAdminPassword();
  }


}
