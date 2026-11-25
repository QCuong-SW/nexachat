import { Module } from '@nestjs/common';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { LlmModule } from '../llm/llm.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';

@Module({
  imports: [LlmModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationRepository,
    MessageRepository,
    UserRateLimitGuard,
  ],
  exports: [ChatService, ConversationRepository, MessageRepository],
})
export class ChatModule {}
