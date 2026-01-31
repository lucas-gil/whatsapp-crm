import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  version() {
    return {
      version: '1.0.0',
      name: 'WhatsAppCRM',
    };
  }
}
