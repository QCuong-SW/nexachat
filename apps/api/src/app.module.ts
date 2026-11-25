import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { OriginGuard } from './common/guards/origin.guard';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './features/auth/auth.module';
import { ChatModule } from './features/chat/chat.module';
import { HealthModule } from './features/health/health.module';
import { LlmModule } from './features/llm/llm.module';
import { UsageModule } from './features/usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    LlmModule,
    ChatModule,
    UsageModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
