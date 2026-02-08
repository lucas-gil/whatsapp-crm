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

  @Get('/debug/admin-key')
  getAdminKeyDebug() {
    return this.appService.getAdminKeyDebug();
  }

  @Get('/debug/admin-key-test')
  testAdminKeyBcrypt() {
    return this.appService.testAdminKeyBcrypt();
  }

  @Post('/admin-key-reset')
  resetAdminKey() {
    return this.appService.resetAdminKey();
  }

  @Post('/admin-key-reset-simple')
  resetAdminKeySimple() {
    return this.appService.resetAdminKeySimple();
  }

  @Post('/force-reset-admin')
  forceResetAdmin() {
    return this.appService.forceResetAdmin();
  }
}
