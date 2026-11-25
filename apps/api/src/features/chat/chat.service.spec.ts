import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus } from '@prisma/client';
import { ContextBuilder } from '../llm/context/context-builder';
import { LlmProviderError } from '../llm/errors/llm-provider.error';
import type { LlmService } from '../llm/llm.service';
import { ChatService, DEFAULT_CONVERSATION_TITLE } from './chat.service';
import type { ConversationRepository } from './repositories/conversation.repository';
import type { MessageRepository } from './repositories/message.repository';

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepo: {
    findManyForUser: jest.Mock;
    findByIdForUser: jest.Mock;
    createForUser: jest.Mock;
    renameForUser: jest.Mock;
    softDeleteForUser: jest.Mock;
    touchLastMessageAt: jest.Mock;
  };
  let messageRepo: {
    findByConversation: jest.Mock;
    findRecentCompleted: jest.Mock;
    countByConversation: jest.Mock;
    create: jest.Mock;
    updateById: jest.Mock;
    markOrphanPendingAsFailed: jest.Mock;
  };
  let llmService: {
    getModelId: jest.Mock;
    generateChatReply: jest.Mock;
  };

  beforeEach(() => {
    conversationRepo = {
      findManyForUser: jest.fn(),
      findByIdForUser: jest.fn(),
      createForUser: jest.fn(),
      renameForUser: jest.fn(),
      softDeleteForUser: jest.fn(),
      touchLastMessageAt: jest.fn(),
    };
    messageRepo = {
      findByConversation: jest.fn(),
      findRecentCompleted: jest.fn(),
      countByConversation: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      markOrphanPendingAsFailed: jest.fn().mockResolvedValue(0),
    };
    llmService = {
      getModelId: jest.fn().mockReturnValue('gemini-3.5-flash-lite'),
      generateChatReply: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'chat.maxHistoryMessages') return 20;
        if (key === 'chat.maxInputChars') return 100;
        if (key === 'chat.maxContextChars') return 32000;
        return undefined;
      }),
    } as unknown as ConfigService;

    const contextBuilder = new ContextBuilder(configService);

    service = new ChatService(
      conversationRepo as unknown as ConversationRepository,
      messageRepo as unknown as MessageRepository,
      llmService as unknown as LlmService,
      contextBuilder,
      configService,
    );
  });

  it('creates conversation with default title when omitted', async () => {
    conversationRepo.createForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      title: DEFAULT_CONVERSATION_TITLE,
    });

    const result = await service.createConversation('user-1', {});
    expect(conversationRepo.createForUser).toHaveBeenCalledWith(
      'user-1',
      DEFAULT_CONVERSATION_TITLE,
    );
    expect(result.id).toBe('conv-1');
  });

  it('throws 404 when listing messages for conversation not owned by user', async () => {
    conversationRepo.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.listMessages('conv-of-other-user', 'user-b', {}),
    ).rejects.toThrow(NotFoundException);
    expect(messageRepo.findByConversation).not.toHaveBeenCalled();
  });

  it('throws 404 when renaming conversation not owned by user', async () => {
    conversationRepo.renameForUser.mockResolvedValue(null);

    await expect(
      service.renameConversation('conv-1', 'user-b', { title: 'Hacked' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when deleting conversation not owned by user or already deleted', async () => {
    conversationRepo.softDeleteForUser.mockResolvedValue(false);

    await expect(
      service.deleteConversation('conv-1', 'user-b'),
    ).rejects.toThrow(NotFoundException);
  });

  it('sends message, sets deterministic title on first message, and persists usage metadata', async () => {
    const now = new Date();
    conversationRepo.findByIdForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      title: DEFAULT_CONVERSATION_TITLE,
    });
    messageRepo.countByConversation.mockResolvedValue(0);
    messageRepo.create
      .mockResolvedValueOnce({
        id: 'msg-user-1',
        conversationId: 'conv-1',
        role: MessageRole.USER,
        content: 'What is a token in LLM?',
        status: MessageStatus.COMPLETED,
        createdAt: now,
      })
      .mockResolvedValueOnce({
        id: 'msg-ast-1',
        conversationId: 'conv-1',
        role: MessageRole.ASSISTANT,
        content: '',
        status: MessageStatus.PENDING,
        model: 'gemini-3.5-flash-lite',
        createdAt: now,
      });
    messageRepo.findRecentCompleted.mockResolvedValue([
      {
        role: MessageRole.USER,
        content: 'What is a token in LLM?',
        status: MessageStatus.COMPLETED,
      },
    ]);
    llmService.generateChatReply.mockResolvedValue({
      content: 'A token is a subword unit.',
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 12, outputTokens: 8 },
      finishReason: 'STOP',
      durationMs: 210,
    });
    messageRepo.updateById.mockResolvedValue({
      id: 'msg-ast-1',
      role: MessageRole.ASSISTANT,
      content: 'A token is a subword unit.',
      status: MessageStatus.COMPLETED,
      model: 'gemini-3.5-flash-lite',
      inputTokens: 12,
      outputTokens: 8,
      finishReason: 'STOP',
    });

    const result = await service.sendMessage('conv-1', 'user-1', {
      content: 'What is a token in LLM?',
      config: { temperature: 0.3 },
    });

    expect(conversationRepo.touchLastMessageAt).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
      now,
      'What is a token in LLM?',
    );
    expect(messageRepo.updateById).toHaveBeenCalledWith(
      'msg-ast-1',
      expect.objectContaining({
        status: MessageStatus.COMPLETED,
        inputTokens: 12,
        outputTokens: 8,
        metadata: { durationMs: 210, contextMessagesUsed: 1 },
      }),
    );
    expect(result.assistantMessage.status).toBe(MessageStatus.COMPLETED);
  });

  it('marks assistant message FAILED (never COMPLETED) when provider throws quota error', async () => {
    conversationRepo.findByIdForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      title: 'Existing',
    });
    messageRepo.countByConversation.mockResolvedValue(2);
    messageRepo.create
      .mockResolvedValueOnce({
        id: 'msg-user-2',
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'msg-ast-2',
        status: MessageStatus.PENDING,
      });
    messageRepo.findRecentCompleted.mockResolvedValue([
      { role: MessageRole.USER, content: 'Hello', status: MessageStatus.COMPLETED },
    ]);
    llmService.generateChatReply.mockRejectedValue(
      new LlmProviderError(
        'LLM_QUOTA_EXCEEDED',
        'Quota reached',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(
      service.sendMessage('conv-1', 'user-1', { content: 'Hello' }),
    ).rejects.toMatchObject({ errorCode: 'LLM_QUOTA_EXCEEDED' });

    expect(messageRepo.updateById).toHaveBeenCalledWith(
      'msg-ast-2',
      expect.objectContaining({
        status: MessageStatus.FAILED,
        finishReason: 'LLM_QUOTA_EXCEEDED',
      }),
    );
  });

  it('rejects messages exceeding maxInputChars', async () => {
    conversationRepo.findByIdForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      title: 'Existing',
    });

    await expect(
      service.sendMessage('conv-1', 'user-1', { content: 'a'.repeat(101) }),
    ).rejects.toThrow(BadRequestException);
  });
});
