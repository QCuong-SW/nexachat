import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'nexa-chat-api',
      timestamp: new Date().toISOString(),
    };
  }
}
