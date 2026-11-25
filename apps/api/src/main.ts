import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 4000;

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Nexa Chat API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
