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

  @Get('/debug/admin-key')
  getAdminKeyDebug() {
    return this.appService.getAdminKeyDebug();
  }

  @Post('/admin-key-reset')
  resetAdminKey() {
    return this.appService.resetAdminKey();
  }
}
