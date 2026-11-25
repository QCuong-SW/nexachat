import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { ContextBuilder } from './context/context-builder';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface';
import { LlmController } from './llm.controller';
import { LlmExperimentsService } from './llm-experiments.service';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini/gemini.provider';
import { ToolExecutionService } from './tools/tool-execution.service';

@Module({
  controllers: [LlmController],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new GeminiProvider(configService),
    },
    LlmService,
    ContextBuilder,
    ToolExecutionService,
    LlmExperimentsService,
    UserRateLimitGuard,
  ],
  exports: [LlmService, LLM_PROVIDER, ContextBuilder, ToolExecutionService],
})
export class LlmModule {}
