import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RunToolsPromptDto, SummarizeTextDto } from './dto/experiments.dto';
import { LlmExperimentsService } from './llm-experiments.service';

/**
 * Các endpoint học mở rộng LLM (tách biệt hoàn toàn khỏi luồng chatbot chính):
 * - POST /api/v1/llm/summarize  (Structured Output)
 * - POST /api/v1/llm/tools/run  (Allowlisted Function Calling)
 */
@Controller('llm')
@UseGuards(JwtAuthGuard, UserRateLimitGuard)
export class LlmController {
  constructor(private readonly experimentsService: LlmExperimentsService) {}

  @Post('summarize')
  @HttpCode(HttpStatus.OK)
  async summarize(@Body() dto: SummarizeTextDto) {
    return this.experimentsService.summarizeText(dto);
  }

  @Post('tools/run')
  @HttpCode(HttpStatus.OK)
  async runTools(@Body() dto: RunToolsPromptDto) {
    return this.experimentsService.runToolPrompt(dto);
  }
}
