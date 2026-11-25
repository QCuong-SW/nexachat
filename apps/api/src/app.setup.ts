import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

/**
 * Dùng chung cho main.ts và integration tests để đảm bảo middleware,
 * CORS, cookie-parser và ValidationPipe giống hệt nhau.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const corsOrigin =
    configService.get<string>('corsOrigin') ?? 'http://localhost:3000';

  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
}
