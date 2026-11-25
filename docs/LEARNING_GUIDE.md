# Nexa Chat — Hướng dẫn Học LLM Engineering Thực Hành (Learning Guide)

> **Mục đích tài liệu:** Đây là tài liệu quan trọng nhất của repository **Nexa Chat**. Thay vì viết lý thuyết sách giáo khoa chung chung, mọi khái niệm LLM Engineering dưới đây đều gắn trực tiếp với **đúng file, đúng class, đúng hàm và đúng bài test** đang chạy trong codebase.

---

## 1. Bảng ánh xạ Khái niệm → Code (Concept-to-Code Map)

| Khái niệm | Vị trí code triển khai | Hàm / Class cốt lõi | File Test đối chứng |
|---|---|---|---|
| **Raw LLM API & Model Discovery** | `apps/api/scripts/gemini-spike.ts` | `ai.models.list()`, `ai.models.generateContent()` | Chạy thủ công: `pnpm spike:gemini` |
| **Context Window** | `apps/api/src/features/llm/context/context-builder.ts` | `ContextBuilder.build()` | `context-builder.spec.ts` |
| **System Prompt** | `apps/api/src/features/llm/prompts/system-prompt.ts` | `DEFAULT_SYSTEM_PROMPT`, `buildSystemPrompt()` | `gemini.provider.spec.ts` |
| **Generation Parameters** | `apps/api/src/features/llm/dto/generation-config.dto.ts` + `gemini.provider.ts` | `GenerationConfigDto`, `SendMessageDto`, `buildGenerationConfig()` | `chat-usage.e2e-spec.ts` |
| **LLM API (Provider Abstraction)** | `apps/api/src/features/llm/providers/gemini/gemini.provider.ts` + `errors/llm-provider.error.ts` | `ILlmProvider`, `GeminiProvider`, `mapGeminiError()` | `gemini.provider.spec.ts` |
| **Token Usage & Latency** | `apps/api/src/features/usage/usage.service.ts` + `usage.controller.ts` | `UsageService.getUserUsage()`, `extractUsage()` | `usage.service.spec.ts`, `chat-usage.e2e-spec.ts` |
| **Streaming (SSE & Abort)** | `gemini.provider.ts` + `chat.service.ts` + `chat.controller.ts` + `apps/web/src/features/chat/` | `generateStream()`, `executeStreamTurn()`, `parseSseBuffer()`, `useChatStream()` | `chat-stream.e2e-spec.ts`, `chat-stream-api.spec.ts`, `use-chat-stream.spec.tsx` |
| **Structured Output** | `apps/api/src/features/llm/llm-experiments.service.ts` + `dto/experiments.dto.ts` | `LlmExperimentsService.summarizeText()`, `SUMMARY_RESPONSE_JSON_SCHEMA`, `SummaryOutputDto` | `llm-experiments.service.spec.ts`, `llm-experiments.e2e-spec.ts` |
| **Function Calling** | `apps/api/src/features/llm/tools/tool-execution.service.ts` + `llm-experiments.service.ts` | `ToolExecutionService.execute()`, `LlmExperimentsService.runToolPrompt()` | `tool-execution.service.spec.ts`, `llm-experiments.e2e-spec.ts` |
| **Authentication & CSRF** | `apps/api/src/features/auth/` + `apps/api/src/common/guards/origin.guard.ts` | `AuthService`, `JwtStrategy`, `OriginGuard` | `auth.service.spec.ts`, `origin.guard.spec.ts`, `auth.e2e-spec.ts` |
| **Conversation Persistence** | `apps/api/src/features/chat/repositories/` + `utils/title-generator.ts` | `ConversationRepository`, `MessageRepository`, `generateDeterministicTitle()` | `chat.service.spec.ts`, `conversations.e2e-spec.ts`, `database.integration.spec.ts` |

---

## 2. Lộ trình đọc code gợi ý cho người mới học

Đừng đọc toàn bộ 160 file cùng lúc. Hãy đi theo đúng **5 chặng** từ đơn giản tới nâng cao:

1. **Chặng 1 — Hiểu lời gọi LLM thô (30 phút):** Đọc `apps/api/scripts/gemini-spike.ts` → hiểu SDK `@google/genai`, model ID, `usageMetadata`, độ trễ.
2. **Chặng 2 — Hiểu nền tảng ứng dụng web an toàn (1 giờ):** Đọc `prisma/schema.prisma` → `features/auth/` → `common/guards/origin.guard.ts` → `features/chat/repositories/conversation.repository.ts`.
3. **Chặng 3 — Hiểu kiến trúc bọc LLM (1 giờ):** Đọc `features/llm/interfaces/llm-provider.interface.ts` → `gemini.provider.ts` → `llm-provider.error.ts` → `system-prompt.ts` → `usage.service.ts`.
4. **Chặng 4 — Hiểu Streaming & Context Window (1.5 giờ):** Đọc `context-builder.ts` → `chat.service.ts` (`executeStreamTurn`) → `chat.controller.ts` (`streamMessage`) → `apps/web/src/features/chat/api/chat-stream-api.ts` → `use-chat-stream.ts`.
5. **Chặng 5 — Hiểu kỹ thuật LLM ứng dụng (1.5 giờ):** Đọc `llm-experiments.service.ts` → `tool-execution.service.ts` → `apps/web/src/features/labs/components/llm-labs-panel.tsx`.

---

## Module 1 — Gemini Spike & Raw LLM API Call

### 1. Vấn đề giải quyết
Trước khi viết hàng chục file Controller/Service/UI, ta cần chứng minh 3 điều cơ bản với chi phí thấp nhất: SDK `@google/genai` kết nối được, `GEMINI_MODEL` tồn tại trên tài khoản Free Tier, và cấu trúc dữ liệu trả về (`text`, `usageMetadata`) khớp kỳ vọng.

### 2. Vì sao tồn tại
Một sai lầm rất hay gặp khi học LLM Engineering là xây xong toàn bộ web app rồi mới gắn API key — đến lúc đó lỗi có thể nằm ở CORS, Auth, SSE, hoặc sai tên model, cực kỳ khó khoanh vùng. Script **Spike** thu gọn bài toán xuống ~60 dòng chạy độc lập qua CLI.

### 3. Khái niệm LLM Engineering minh hoạ
- **Model Discovery (`ai.models.list()`)**: Tên model LLM thay đổi thường xuyên theo vòng đời phát hành; kiểm tra danh sách model khả dụng giúp tránh đoán mò và tránh fallback ngoài ý muốn sang model trả phí.
- **Tokenization & `usageMetadata`**: LLM không tính chi phí/hạn mức theo số từ hay số câu, mà theo **token** (`promptTokenCount`, `candidatesTokenCount`). Tiếng Việt có dấu thường tốn nhiều token hơn tiếng Anh cho cùng độ dài chữ.
- **Stateless Non-Streaming Latency**: Với `generateContent()`, client phải đợi mô hình sinh tới token cuối cùng mới nhận được bất kỳ chữ nào.

### 4. File và hàm triển khai
- `apps/api/scripts/gemini-spike.ts` — hàm `main()`:
  - Nạp `.env`, kiểm tra thiếu key thì thoát sạch (`exit(2)`) mà **không in API key**.
  - Lặp `for await (const model of await ai.models.list())` đối chiếu `GEMINI_MODEL`.
  - Nếu không khớp → thoát `exit(3)` (tuyệt đối không tự fallback).
  - Nếu khớp → gọi `ai.models.generateContent()` và in `response.text`, `response.usageMetadata`, thời gian `elapsedMs`.

### 5. Luồng dữ liệu
```text
.env (GEMINI_API_KEY, GEMINI_MODEL)
   │
   ▼
gemini-spike.ts
   ├─► Bước 1: ai.models.list() ──► đối chiếu GEMINI_MODEL (không khớp -> DỪNG)
   └─► Bước 2: ai.models.generateContent() ──► in text + usageMetadata + latency (ms)
```

### 6. Lỗi thường gặp
- Cài nhầm package cũ `@google/generative-ai` thay vì SDK mới chính thức `@google/genai`.
- In nguyên `console.error(err)` hoặc `console.log(process.env)` làm lộ API key lên terminal/CI log.

### 7. Cần hiểu trước khi sửa
- File này **không được import** vào bất kỳ module nào của NestJS (`tsconfig.build.json` đã loại trừ thư mục `scripts/`). Ứng dụng thật chỉ gọi Gemini qua `GeminiProvider`.

### 8. Bài tập thực hành
1. Sau khi cấu hình `GEMINI_API_KEY`, chạy `pnpm spike:gemini`. Ghi lại `promptTokenCount`, `candidatesTokenCount` và `latency`.
2. Đổi prompt trong `gemini-spike.ts` từ 1 câu tiếng Việt sang 1 đoạn tiếng Anh cùng số từ → so sánh `promptTokenCount` giữa hai ngôn ngữ.
3. Thử đặt `GEMINI_MODEL=non-existent-model` và chạy `pnpm spike:gemini` để kiểm chứng cơ chế dừng an toàn (exit code 3).

### 9. Có thể hoãn học lúc này
- Thuật toán tách token BPE / SentencePiece ở mức toán học.

---

## Module 2 — Authentication, Cookie Security & CSRF Protection

### 1. Vấn đề giải quyết
Định danh từng người dùng để cô lập lịch sử hội thoại, hạn chế lạm dụng quota Free Tier theo từng tài khoản, và bảo vệ phiên đăng nhập khỏi XSS lẫn CSRF.

### 2. Vì sao tồn tại
- **Tại sao dùng HttpOnly cookie thay vì `localStorage`?** Nếu ứng dụng có lỗ hổng XSS (ví dụ từ thư viện bên thứ ba hoặc render Markdown sai), mã JS độc hại đọc được `localStorage.getItem('token')` ngay lập tức, nhưng **không thể đọc** HttpOnly cookie.
- **Tại sao cần thêm `OriginGuard` khi đã có `SameSite=Lax`?** Defence-in-depth (phòng thủ theo chiều sâu): `OriginGuard` kiểm tra `Origin` / `Referer` / `Sec-Fetch-Site` trên mọi `POST`/`PUT`/`PATCH`/`DELETE`, chặn request giả mạo ngay cả trên các ngữ cảnh trình duyệt cũ hoặc subdomain lạ.

### 3. Khái niệm kỹ thuật minh hoạ
- **Argon2id**: Thuật toán băm mật khẩu kháng GPU/ASIC (tốt hơn bcrypt/SHA-256) với salt ngẫu nhiên tự sinh cho từng user.
- **Email Normalization**: `email.trim().toLowerCase()` ngăn tạo 2 tài khoản `Alice@x.com` và `alice@x.com`.
- **Anti-Enumeration**: Sai email và sai mật khẩu đều trả chung `401 INVALID_CREDENTIALS` (`Invalid email or password.`).

### 4. File và hàm triển khai
- `apps/api/src/features/auth/auth.service.ts`:
  - `PUBLIC_USER_SELECT`: whitelist cột được trả về, loại trừ `passwordHash` ở mức truy vấn SQL.
  - `normalizeEmail()`, `hashPassword()` (`argon2.argon2id`), `verifyPassword()`, `register()`, `login()`, `getAuthenticatedUser()`.
- `apps/api/src/features/auth/auth.controller.ts`:
  - `setSessionCookie()` đặt `{ httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/', maxAge }`.
  - `logout()` gọi `res.clearCookie()` với cùng option để trình duyệt xoá sạch cookie.
- `apps/api/src/features/auth/strategies/jwt.strategy.ts`:
  - `extractJwtFromCookie(cookieName)` chỉ chấp nhận token từ `req.cookies`.
- `apps/api/src/common/guards/origin.guard.ts`:
  - Đăng ký toàn cục qua `APP_GUARD` trong `app.module.ts`.
- `apps/api/src/common/filters/http-exception.filter.ts`:
  - Chuẩn hoá lỗi về `{ error: { code, message, details? } }`, ẩn hoàn toàn stack trace.

### 5. Luồng dữ liệu
```text
Browser (credentials: 'include')
  │ POST /api/v1/auth/login (Origin: http://localhost:3000)
  ▼
cookieParser() -> CORS -> OriginGuard -> ValidationPipe(LoginDto)
  ▼
AuthController.login() -> AuthService.login()
  ├─ normalizeEmail()
  ├─ prisma.user.findUnique()
  ├─ argon2.verify()
  └─ jwtService.signAsync({ sub, email })
  ▼
Set-Cookie: nexa_session=<jwt>; HttpOnly; SameSite=Lax; Path=/
Body: { "user": { id, email, displayName, createdAt, updatedAt } }
```

### 6. Lỗi thường gặp
- Quên `credentials: 'include'` ở `fetch` (Next.js) hoặc quên `credentials: true` ở `app.enableCors()` (NestJS) → cookie bị trình duyệt bỏ qua.
- Không truyền cùng `path`/`sameSite` khi gọi `res.clearCookie()` → người dùng bấm Logout nhưng vẫn còn đăng nhập.
- Trả thẳng bản ghi `prisma.user.create(...)` không có `select` → làm lộ `passwordHash` trong response JSON.

### 7. Cần hiểu trước khi sửa
- `SameSite=Lax` hoạt động khi frontend và backend cùng site (ví dụ `localhost:3000` và `localhost:4000`, hoặc `app.domain.com` và `api.domain.com`). Nếu sau này deploy lên 2 domain khác gốc hoàn toàn (ví dụ `vercel.app` và `render.com`), cookie `SameSite=Lax` sẽ không được trình duyệt gửi kèm.

### 8. Bài tập thực hành
1. Chạy `pnpm --filter @nexa-chat/api test:e2e -- auth.e2e-spec.ts` và đọc 5 test case trong `apps/api/test/auth.e2e-spec.ts`.
2. Khởi chạy API và gửi thử `curl -i -X POST http://localhost:4000/api/v1/auth/login -H "Origin: https://evil.example" -H "Content-Type: application/json" -d "{}"` → xác nhận nhận `403 INVALID_ORIGIN`.

### 9. Có thể hoãn học lúc này
- Refresh Token Rotation, thu hồi session bằng blacklist, OAuth2/Google Login, xác minh email.

---

## Module 3 — Conversation Persistence, Ownership & Soft Delete

### 1. Vấn đề giải quyết
**LLM hoàn toàn vô trạng thái (stateless).** Khi bạn hỏi câu thứ 2 *"Giải thích kỹ hơn ý thứ 2 đi"*, Gemini không hề nhớ câu thứ 1 trừ khi ứng dụng lưu toàn bộ lịch sử vào PostgreSQL và gửi lại trong request kế tiếp. Ngoài ra, ứng dụng nhiều người dùng phải bảo đảm không có lỗ hổng IDOR (người này xem trộm hội thoại người kia).

### 2. Vì sao tồn tại
Thay vì để `ChatService` gọi `prisma.conversation.*` rải rác khắp nơi (rất dễ quên `where: { userId, deletedAt: null }` ở một hàm nào đó), ta đóng gói toàn bộ truy vấn vào **`ConversationRepository`** — biến quy tắc ownership + soft-delete thành **bất biến kiến trúc (invariant)**.

### 3. Khái niệm LLM Engineering & Backend minh hoạ
- **Application-Managed Memory**: Bộ nhớ hội thoại nằm trong bảng `conversations` và `messages` của PostgreSQL, không nằm trong mô hình AI.
- **Deterministic Title Generation (`generateDeterministicTitle`)**: Cắt gọn câu hỏi đầu tiên ở ranh giới từ (~50 ký tự) thay vì gọi thêm 1 request LLM chỉ để đặt tiêu đề → tiết kiệm 50% số lượt gọi (RPD) ở hội thoại ngắn trên Free Tier.
- **Cursor Pagination**: Dùng `cursor: { id }` kết hợp `take: limit + 1` giúp không bị trùng hoặc bỏ sót bản ghi khi có tin nhắn mới xen vào (khắc phục điểm yếu của `OFFSET`).

### 4. File và hàm triển khai
- `apps/api/src/features/chat/repositories/conversation.repository.ts`:
  - `findManyForUser()`, `findByIdForUser()`, `createForUser()`, `renameForUser()`, `softDeleteForUser()`, `touchLastMessageAt()`.
- `apps/api/src/features/chat/repositories/message.repository.ts`:
  - `findByConversation()` (cursor pagination), `findRecentCompleted()` (lấy N tin `COMPLETED` mới nhất rồi đảo ngược về thứ tự cũ → mới cho LLM), `markOrphanPendingAsFailed()`.
- `apps/api/src/features/chat/utils/title-generator.ts`: `generateDeterministicTitle()`.
- `apps/api/src/features/chat/chat.service.ts`: `getConversationOrThrow()` trả chung `404 CONVERSATION_NOT_FOUND` (không dùng `403` để tránh lộ UUID hợp lệ của người khác).
- `apps/web/src/features/conversations/`: `conversations-api.ts`, `use-conversations.tsx` (TanStack Query), `group-by-date.ts` (`Today`, `Previous 7 Days`, `Older`).

### 5. Luồng dữ liệu
```text
AppSidebar -> useConversations(debouncedSearch) [TanStack Query]
  │ GET /api/v1/conversations?search=sse&limit=50
  ▼
JwtAuthGuard -> ChatController -> ChatService -> ConversationRepository
  │ SELECT * FROM conversations
  │ WHERE user_id = $1 AND deleted_at IS NULL AND title ILIKE '%sse%'
  │ ORDER BY last_message_at DESC, id DESC LIMIT 51
  ▼
{ items: Conversation[<=50], nextCursor: uuid | null }
```

### 6. Lỗi thường gặp
- Gọi `prisma.conversation.findUnique({ where: { id } })` rồi quên kiểm tra `conversation.userId === currentUser.id`.
- Soft-delete ở `GET /conversations` nhưng quên kiểm tra `deletedAt: null` ở `PATCH /conversations/:id` hoặc `POST /conversations/:id/messages/stream`.
- Lấy `findRecentCompleted` theo `createdAt DESC` rồi quên `.reverse()`, khiến lịch sử gửi lên Gemini bị đảo ngược thời gian!

### 7. Cần hiểu trước khi sửa
- Không bao giờ gọi trực tiếp `prisma.conversation` trong `ChatController` hay `ChatService`; luôn đi qua `ConversationRepository`.

### 8. Bài tập thực hành
1. Đọc `apps/api/test/conversations.e2e-spec.ts` để xem cách kiểm thử Alice & Bob chứng minh mọi thao tác đọc/sửa/xoá chéo đều trả `404`.
2. Giải thích vì sao `findManyForUser` lấy `take: options.limit + 1` thay vì `take: options.limit` rồi chạy thêm 1 câu `COUNT(*)`. *(Gợi ý: chỉ cần biết có trang kế tiếp hay không mà không tốn thêm 1 query đếm toàn bảng.)*

### 9. Có thể hoãn học lúc này
- Full-text search trên nội dung tin nhắn (`tsvector` + GIN index) hay tìm kiếm ngữ nghĩa (RAG / pgvector).

---

## Module 4 — LLM Provider Abstraction, System Prompt, Generation Params & Error Taxonomy

### 1. Vấn đề giải quyết
Đóng gói toàn bộ tương tác với SDK `@google/genai` vào một adapter duy nhất để:
1. Controller và `ChatService` không phụ thuộc trực tiếp vào chi tiết SDK của Google.
2. Toàn bộ test tự động chạy bằng mock provider (nhanh, ổn định, không tốn quota Free Tier).
3. Kiểm soát tập trung model Free Tier, system prompt, phạm vi tham số và ánh xạ lỗi an toàn.

### 2. Vì sao tồn tại
Nếu gọi thẳng `new GoogleGenAI(...)` trong `ChatController`:
- Bạn không thể viết unit test hay Supertest test cho `ChatService` mà không đốt quota thật.
- Lỗi thô từ Google (ví dụ `RESOURCE_EXHAUSTED` hoặc `API_KEY_INVALID`) bị trả nguyên xi về trình duyệt, thậm chí có nguy cơ lộ API key hoặc cấu trúc nội bộ.

### 3. Khái niệm LLM Engineering minh hoạ
- **System Prompt (`buildSystemPrompt`)**: Chỉ dẫn định hình vai trò, giọng điệu, định dạng Markdown và thái độ trung thực khi không chắc chắn. Luôn do backend kiểm soát; **tuyệt đối không nhận `systemPrompt` từ request body của frontend**.
- **Generation Parameters (`GenerationConfigDto`)**:
  - `temperature` (`0.0 – 2.0`): điều khiển độ ngẫu nhiên khi lấy mẫu token kế tiếp (`0.0` cho câu trả lời ổn định/kỹ thuật; `1.0+` tăng độ đa dạng ngôn từ).
  - `maxOutputTokens` (`64 – 8192`): giới hạn trần số token đầu ra để tránh phản hồi quá dài gây tốn quota TPM và tăng độ trễ.
- **Model Lock (Free Tier Safety)**: `GEMINI_MODEL` chỉ đọc từ biến môi trường backend. `SendMessageDto` không có field `model`, và `ValidationPipe({ forbidNonWhitelisted: true })` từ chối ngay lập tức (`400 VALIDATION_ERROR`) nếu client cố gửi `model: "gemini-2.5-pro"`.
- **Error Taxonomy (`mapGeminiError`)**: Phân loại rõ lỗi hạ tầng (`LLM_NETWORK_ERROR`, `LLM_TIMEOUT`, `LLM_UNAVAILABLE`), lỗi hạn mức (`LLM_QUOTA_EXCEEDED`, `LLM_RATE_LIMITED`), lỗi cấu hình (`LLM_API_KEY_MISSING`, `LLM_INVALID_API_KEY`) và lỗi đầu ra (`LLM_INVALID_OUTPUT`).

### 4. File và hàm triển khai
- `apps/api/src/features/llm/interfaces/llm-provider.interface.ts`: token `LLM_PROVIDER`, interface `ILlmProvider` tách 4 năng lực (`generate`, `generateStream`, `generateStructured`, `generateWithTools`).
- `apps/api/src/features/llm/providers/gemini/gemini.provider.ts`: `GeminiProvider` (hỗ trợ `injectedClient` cho unit test, `withTimeout()` 30 giây, `extractUsage()` trả `null` nếu thiếu `usageMetadata`).
- `apps/api/src/features/llm/errors/llm-provider.error.ts`: `LlmProviderError`, `mapGeminiError()`.
- `apps/api/src/features/llm/prompts/system-prompt.ts`: `buildSystemPrompt()`.
- `apps/api/src/features/llm/dto/generation-config.dto.ts`: `GenerationConfigDto`, `SendMessageDto`.
- `apps/api/src/features/llm/llm.service.ts`: facade gắn `buildSystemPrompt()` trước khi gọi `ILlmProvider`.

### 5. Luồng dữ liệu
```text
ChatService ──► LlmService.generateChatReply(messages, config)
                  │ gắn buildSystemPrompt() từ backend
                  ▼
                ILlmProvider (DI Token: LLM_PROVIDER)
                  │ triển khai thực: GeminiProvider (@google/genai)
                  ├─► Thành công: { content, model, usage: { inputTokens|null, outputTokens|null }, finishReason, durationMs }
                  └─► Lỗi SDK/HTTP/Timeout: mapGeminiError() -> LlmProviderError (chỉ log code + model, KHÔNG log key)
```

### 6. Lỗi thường gặp
- Tự gán `inputTokens: 0` hoặc tự đoán số token khi provider không trả `usageMetadata`, làm sai lệch dữ liệu thống kê (đúng phải là `null`).
- Bắt lỗi bằng `catch (e) { throw new InternalServerErrorException(e.message); }` làm lộ thông tin nội bộ hoặc key.
- Quên đặt timeout khi gọi HTTP ra ngoài (request có thể treo vĩnh viễn làm rò rỉ kết nối).

### 7. Cần hiểu trước khi sửa
- Không thêm logic fallback sang model khác bên trong `GeminiProvider`. Nếu model hết quota hoặc không tồn tại, phải báo lỗi trung thực về UI.
- Khi viết test E2E mới, luôn override `.overrideProvider(LLM_PROVIDER).useValue(mock)` để không bao giờ gọi API thật trong CI/test tự động.

### 8. Bài tập thực hành
1. Đọc `apps/api/src/features/llm/providers/gemini/gemini.provider.spec.ts` để xem cách test kiểm chứng 6 loại lỗi và assert response không chứa chuỗi secret key.
2. Khi có key thật, thử gửi cùng một câu hỏi *"Viết 3 khẩu hiệu cho ứng dụng học lập trình"* với `temperature: 0.0` (chạy 2 lần) và `temperature: 1.5` (chạy 2 lần) rồi so sánh mức độ giống nhau giữa các lần chạy.

### 9. Có thể hoãn học lúc này
- Multi-provider router (OpenAI + Anthropic + Gemini), semantic caching, prompt A/B testing platform.

---

## Module 5 — Token Usage & Latency Tracking

### 1. Vấn đề giải quyết
Giúp người học nhìn thấy trực quan mỗi câu hỏi/trả lời tiêu tốn bao nhiêu `inputTokens`, `outputTokens` và mất bao nhiêu mili-giây (`durationMs`), đồng thời hiểu giới hạn Free Tier.

### 2. Vì sao tồn tại
Trong LLM Engineering, bạn không thể tối ưu chi phí hay độ trễ nếu không đo đạc. Lưu `inputTokens`, `outputTokens`, `model`, `finishReason` và `metadata.durationMs` ngay trên từng dòng `Message` của PostgreSQL cho phép truy vết chi tiết từng lượt chat lẫn tổng hợp theo người dùng.

### 3. Khái niệm LLM Engineering minh hoạ
- **Input vs Output Token Asymmetry**: Trong hội thoại dài, `inputTokens` tăng nhanh qua từng lượt vì toàn bộ lịch sử nằm trong cửa sổ context phải được gửi lại mỗi lần gọi!
- **Honest Observability**: Chỉ cộng dồn các bản ghi thực sự có dữ liệu token (`messagesWithTokenData`), không bịa số liệu cho tin nhắn bị lỗi hay bị huỷ giữa chừng.

### 4. File và hàm triển khai
- `apps/api/src/features/usage/usage.service.ts`: `UsageService.getUserUsage(userId)` — lọc `role: ASSISTANT` thuộc các hội thoại `userId` chưa bị `deletedAt`, tính tổng `inputTokens`, `outputTokens`, `completedMessages`, `failedMessages`, `cancelledMessages`, `averageDurationMs`.
- `apps/api/src/features/usage/usage.controller.ts`: `GET /api/v1/usage/me` (bảo vệ bằng `JwtAuthGuard`).
- `apps/web/src/features/settings/components/settings-panel.tsx` + `hooks/use-usage.ts`: hiển thị thẻ thống kê trên trang `/settings`.

### 5. Luồng dữ liệu
```text
ChatService (hoàn tất lượt chat) ──► Lưu inputTokens, outputTokens, metadata.durationMs vào bảng messages
                                            │
SettingsPanel (/settings) ──► GET /api/v1/usage/me ──► UsageService.getUserUsage(user.id) ──► JSON tổng hợp
```

### 6. Lỗi thường gặp
- Tính `UsageService` trên toàn bảng `messages` mà quên lọc theo `conversation.userId` (lộ thống kê của người dùng khác).
- Quên chia trung bình `averageDurationMs` theo đúng số bản ghi **có** `durationMs` (chia cho tổng số message sẽ kéo sai số trung bình xuống).

### 7. Cần hiểu trước khi sửa
- Nếu sau này lượng tin nhắn rất lớn (hàng trăm nghìn dòng/user), có thể chuyển sang dùng SQL `SUM`/`AVG` qua `prisma.$queryRaw` hoặc bảng tổng hợp ngày; ở quy mô hiện tại, truy vấn có index theo user là đủ nhanh và dễ đọc.

### 8. Bài tập thực hành
1. Mở `apps/api/src/features/usage/usage.service.spec.ts` và giải thích vì sao `messagesWithTokenData = 1` trong khi `completedMessages = 2`.
2. Gửi 5 lượt chat liên tiếp trong cùng 1 hội thoại và quan sát `inputTokens` của lượt 5 so với lượt 1 trong UI (`MessageBubble`) để thấy trực tiếp hiệu ứng tích luỹ lịch sử context.

### 9. Có thể hoãn học lúc này
- Bảng giá ước tính USD theo từng tier, OpenTelemetry distributed tracing, biểu đồ time-series.

---

## Module 6 — Context Window & Sliding History Budget

### 1. Vấn đề giải quyết
PostgreSQL lưu toàn bộ hàng trăm tin nhắn của cuộc trò chuyện, nhưng nếu gửi tất cả sang Gemini ở mỗi lượt:
1. Tốn cực nhiều `inputTokens` (nhanh chạm giới hạn TPM Free Tier).
2. Tăng độ trễ phản hồi.
3. Dễ chạm giới hạn Context Window của mô hình.

### 2. Vì sao tồn tại
`ContextBuilder` đóng vai trò **cổng kiểm soát bộ nhớ ngắn hạn** nằm giữa Database (bộ nhớ dài hạn) và `LlmService` (mô hình).

### 3. Khái niệm LLM Engineering minh hoạ
- **Two-Stage Context Truncation**:
  - Bước 1: Chỉ lấy tin `COMPLETED` (loại bỏ các tin `FAILED`, `CANCELLED` hoặc `PENDING` gây nhiễu ngữ cảnh).
  - Bước 2: Cắt theo số lượng tin nhắn (`MAX_HISTORY_MESSAGES = 20`).
  - Bước 3: Cắt tiếp theo ngân sách ký tự (`MAX_CONTEXT_CHARS = 32000` — ước lượng ~4 ký tự/token, tương đương ~8.000 token lịch sử, giúp không tốn thêm quota gọi API `countTokens`).
- **Newest-Message Invariant**: Duyệt ngược từ tin mới nhất về cũ nhất và **luôn giữ tin nhắn cuối cùng của người dùng** để mô hình không bao giờ nhận mảng `messages` rỗng.

### 4. File và hàm triển khai
- `apps/api/src/features/llm/context/context-builder.ts` — `ContextBuilder.build(chronologicalMessages, overrides?)`, trả về `{ messages, stats: { totalCandidates, includedCount, droppedCount, estimatedChars, ... } }`.

### 5. Luồng dữ liệu
```text
MessageRepository.findRecentCompleted(convId, 20)
   │ [m1(USER), m2(AST), ..., m20(USER - mới nhất)]
   ▼
ContextBuilder.build()
   ├─ Lọc status === COMPLETED && content.trim().length > 0
   ├─ Cắt tối đa MAX_HISTORY_MESSAGES tin cuối
   └─ Duyệt ngược từ mới -> cũ, dừng khi vượt MAX_CONTEXT_CHARS (nhưng luôn giữ tin mới nhất)
   ▼
LlmMessage[] gọn gàng gửi cho GeminiProvider
```

### 6. Lỗi thường gặp
- Gửi cả các tin nhắn `FAILED` (nội dung rỗng) hoặc `CANCELLED` (câu trả lời cụt giữa chừng) vào lịch sử khiến mô hình bị nhiễu hoặc lỗi luân phiên `user`/`model`.
- Cắt từ tin mới nhất thay vì tin cũ nhất (làm mất câu hỏi người dùng vừa nhập!).

### 7. Cần hiểu trước khi sửa
- `estimatedChars` là **ước lượng theo ký tự**, không phải số token chính xác tuyệt đối. Nếu bạn muốn chính xác 100%, cần dùng `ai.models.countTokens()`, nhưng lưu ý nó tiêu tốn thêm request quota.

### 8. Bài tập thực hành
1. Đọc `apps/api/src/features/llm/context/context-builder.spec.ts` (3 test case).
2. Thử viết thêm 1 unit test với 30 tin nhắn, mỗi tin dài 2.000 ký tự, `maxHistoryMessages = 20`, `maxContextChars = 10000`, và tự tính trước `includedCount` + `droppedCount` rồi chạy `pnpm --filter @nexa-chat/api test -- context-builder` để đối chiếu.

### 9. Có thể hoãn học lúc này
- Tóm tắt cuốn chiếu lịch sử cũ (rolling summary memory) hoặc truy xuất tin nhắn cũ liên quan bằng embedding (long-term semantic memory).

---

## Module 7 — Real-Time Streaming (SSE), Cancellation, Orphan Cleanup & Rate Limiting

### 1. Vấn đề giải quyết
- Giảm **TTFT (Time To First Token)**: người dùng thấy từng chữ xuất hiện ngay thay vì đợi 5–10 giây màn hình trắng.
- Cho phép bấm **Dừng (Stop)** giữa chừng và lưu trung thực trạng thái `CANCELLED` (giữ lại phần chữ đã sinh, tuyệt đối không đánh dấu `COMPLETED`).
- Ngăn một user spam làm cạn quota Free Tier dùng chung cho cả dự án.

### 2. Vì sao tồn tại
- **Tại sao dùng `POST` + `fetch` + `ReadableStream` thay vì `EventSource`?** Chuẩn `EventSource` của trình duyệt chỉ hỗ trợ phương thức `GET`, không gửi được body JSON (`content`, `config`) và không tiện kiểm soát lỗi HTTP 400/404/429 trước khi stream.
- **Tại sao `prepareStreamTurn()` chạy TRƯỚC `res.flushHeaders()`?** Một khi đã gửi `200 text/event-stream`, HTTP status code không đổi được nữa. Kiểm tra ownership (`404`) và độ dài input (`400`) trước khi mở stream giúp API giữ đúng ngữ nghĩa REST.
- **Tại sao dùng `res.on('close')` kiểm tra `!res.writableEnded`?** Trên Node.js 18+, `req.on('close')` bắn ra ngay khi đọc xong body POST, không phải khi client đóng tab! Kiểm tra `res.on('close')` khi `!res.writableEnded` mới phát hiện chính xác lúc client ngắt kết nối giữa chừng để kích hoạt `abortController.abort()`.

### 3. Khái niệm LLM Engineering minh hoạ
- **Typed SSE Event Contract**:
  - `message.started`: gửi ngay ID của user message, assistant message và tên model.
  - `message.delta`: từng đoạn văn bản nhỏ sinh ra liên tục.
  - `message.completed`: tín hiệu hoàn tất kèm toàn văn, token usage thật, `finishReason` và `durationMs`.
  - `message.error`: báo lỗi sạch giữa stream (ví dụ chạm quota 429 giữa chừng).
- **Orphan `PENDING` Recovery**: Trong `ChatService.onModuleInit()`, nếu server từng bị tắt đột ngột khi đang stream, mọi tin nhắn `PENDING` mồ côi sẽ tự chuyển sang `FAILED` (`SERVER_INTERRUPTED`).
- **Sliding-Window Per-User Rate Limit**: `UserRateLimitGuard` giới hạn số request gọi LLM theo `userId` (`RATE_LIMIT_MAX_REQUESTS` trong `RATE_LIMIT_TTL_MS`), trả `429` + header `Retry-After`.

### 4. File và hàm triển khai
- `apps/api/src/features/chat/types/stream-events.types.ts` — `ChatStreamEvent`, `formatSseEvent()`.
- `apps/api/src/features/chat/chat.controller.ts` — `streamMessage()` (SSE headers + `X-Accel-Buffering: no` + `res.on('close')` → `abortController.abort()`).
- `apps/api/src/features/chat/chat.service.ts` — `onModuleInit()`, `prepareStreamTurn()`, `executeStreamTurn()`.
- `apps/api/src/common/guards/user-rate-limit.guard.ts` — `UserRateLimitGuard`.
- `apps/web/src/features/chat/api/chat-stream-api.ts` — `parseSseBuffer()` (xử lý frame SSE bị chia cắt qua nhiều chunk TCP), `streamConversationMessage()`.
- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — `useChatStream()` (optimistic UI, tích luỹ delta, `AbortController`, làm mới TanStack Query cache khi kết thúc).

### 5. Luồng dữ liệu
```text
ChatComposer -> ChatView -> useChatStream (tạo AbortController)
  │ POST /api/v1/conversations/:id/messages/stream (fetch + ReadableStream)
  ▼
JwtAuthGuard -> OriginGuard -> UserRateLimitGuard -> ChatController.streamMessage()
  ├─ 1. prepareStreamTurn() -> lỗi 404/400 trả JSON ngay
  ├─ 2. Ghi headers SSE + flushHeaders() + gắn res.on('close') -> abort()
  ├─ 3. Lưu USER -> ContextBuilder -> tạo ASSISTANT (PENDING)
  ├─ 4. emit('message.started')
  ├─ 5. for await (chunk of llmService.streamChatReply(..., signal))
  │       └─ emit('message.delta')  --> Frontend parseSseBuffer() -> cộng dồn text
  └─ 6. Kết thúc:
        - Bình thường -> update(COMPLETED + tokens) -> emit('message.completed')
        - Bị Stop/ngắt -> update(CANCELLED + partial text)
        - Lỗi provider -> update(FAILED + errorCode) -> emit('message.error')
```

### 6. Lỗi thường gặp
- Không giữ `remainder` trong `parseSseBuffer()` → lỗi `JSON.parse` ngẫu nhiên khi 1 sự kiện SSE bị tách qua 2 gói mạng TCP.
- Đánh dấu tin bị Stop là `COMPLETED` → làm hỏng ngữ cảnh ở các lượt hỏi sau.
- Quên `X-Accel-Buffering: no` khi đặt sau Nginx làm mất hiệu ứng streaming.

### 7. Cần hiểu trước khi sửa
- `UserRateLimitGuard` lưu timestamp trong `Map` RAM của tiến trình Node (chấp nhận theo kiến trúc không Redis). Khi restart server, bộ đếm reset về 0.

### 8. Bài tập thực hành
1. Đọc `apps/api/test/chat-stream.e2e-spec.ts` để xem 4 kịch bản kiểm thử tự động: stream thành công, lỗi quota giữa chừng (`FAILED`), huỷ giữa chừng (`CANCELLED` giữ text dở dang), và truy cập hội thoại người khác (`404` trước khi mở SSE).
2. Đọc `apps/web/src/features/chat/api/chat-stream-api.spec.ts` để thấy cách `parseSseBuffer` ghép 1 JSON event bị cắt làm đôi.

### 9. Có thể hoãn học lúc này
- WebSockets hai chiều (SSE một chiều từ server về client đã đơn giản và chuẩn hơn cho text streaming), Redis distributed rate limiting.

---

## Module 8 — Structured Output (2-Layer Schema Validation)

### 1. Vấn đề giải quyết
Khi cần LLM trích xuất dữ liệu để hiển thị thành thẻ/bảng hoặc lưu vào cột cố định (ví dụ `{ title, summary, keyPoints[] }`), việc chỉ nhắc trong prompt *"Hãy trả về JSON"* rất hay lỗi (mô hình bọc thêm ` ```json `, sai tên key hoặc thiếu mảng).

### 2. Vì sao tồn tại
Áp dụng mô hình **bảo vệ 2 lớp**:
- **Lớp 1 (Tại mô hình):** Cấu hình `responseMimeType: 'application/json'` và `responseJsonSchema: SUMMARY_RESPONSE_JSON_SCHEMA` trong `GeminiProvider.generateStructured()`.
- **Lớp 2 (Tại Backend):** Luôn parse JSON và kiểm tra lại bằng `class-validator` (`SummaryOutputDto`) trong `LlmExperimentsService.summarizeText()`. Nếu đầu ra vẫn sai kiểu/thiếu phần tử, trả lỗi sạch `502 LLM_INVALID_OUTPUT` thay vì đẩy dữ liệu hỏng xuống UI.

### 3. Khái niệm LLM Engineering minh hoạ
- **Constrained Decoding / Structured Output**: Ràng buộc đầu ra của LLM theo JSON Schema ở tầng sinh token.
- **Never Trust Model Output Blindly**: Ngay cả khi bật JSON Schema, backend vẫn phải coi output từ LLM như dữ liệu đầu vào bên ngoài cần validate trước khi sử dụng.

### 4. File và hàm triển khai
- `apps/api/src/features/llm/dto/experiments.dto.ts` — `SummarizeTextDto`, `SummaryOutputDto`.
- `apps/api/src/features/llm/llm-experiments.service.ts` — `SUMMARY_RESPONSE_JSON_SCHEMA`, `summarizeText()`.
- `apps/api/src/features/llm/providers/gemini/gemini.provider.ts` — `generateStructured()`.
- `apps/api/src/features/llm/llm.controller.ts` — `POST /api/v1/llm/summarize`.
- `apps/web/src/features/labs/components/llm-labs-panel.tsx` — giao diện thử nghiệm tách biệt tại `/labs`.

### 5. Luồng dữ liệu
```text
/labs (Summary Form) -> POST /api/v1/llm/summarize
  ▼
LlmController -> LlmExperimentsService.summarizeText()
  ├─ 1. LlmService.generateStructured(SUMMARY_RESPONSE_JSON_SCHEMA) -> GeminiProvider
  ├─ 2. JSON.parse(rawText) (lỗi -> 502 LLM_INVALID_OUTPUT)
  └─ 3. validateSync(plainToInstance(SummaryOutputDto, data)) (lỗi -> 502 LLM_INVALID_OUTPUT)
  ▼
200 OK: { result: { title, summary, keyPoints }, model, usage, durationMs }
```

### 6. Lỗi thường gặp
- Chỉ dùng `JSON.parse()` mà không kiểm tra kiểu từng trường → nếu model trả `{ title: 123, keyPoints: [] }`, frontend `.map()` hoặc hiển thị sẽ lỗi.

### 7. Cần hiểu trước khi sửa
- Mọi thay đổi ở `SUMMARY_RESPONSE_JSON_SCHEMA` phải được cập nhật đồng bộ trong `SummaryOutputDto` để 2 lớp schema luôn khớp nhau.

### 8. Bài tập thực hành
1. Đọc `apps/api/test/llm-experiments.e2e-spec.ts` (case trả JSON lỗi `{ title: 123, summary: '' }` → API trả `502 LLM_INVALID_OUTPUT`).
2. Thử mở rộng schema (bài tập tự làm trên nhánh riêng) thêm trường `sentiment: "positive" | "neutral" | "negative"` ở cả `SUMMARY_RESPONSE_JSON_SCHEMA`, `SummaryOutputDto` và unit test.

### 9. Có thể hoãn học lúc này
- Tự động retry kèm thông báo lỗi schema (self-healing structured output loop) vì có thể nhân đôi lượng tiêu thụ quota Free Tier.

---

## Module 9 — Function Calling An Toàn (Allowlisted Tool Loop)

### 1. Vấn đề giải quyết
LLM sinh chữ theo xác suất nên yếu ở hai nhóm tác vụ: dữ liệu thời gian thực (không biết đồng hồ hiện tại) và tính toán chính xác (hay đếm nhầm số từ/ký tự). Function Calling cho phép mô hình *đề xuất* gọi hàm backend để lấy dữ liệu thật rồi mới trả lời người dùng.

### 2. Vì sao tồn tại
Function Calling là cửa ngõ phổ biến nhất dẫn tới lỗ hổng bảo mật trong ứng dụng AI (Prompt Injection → gọi hàm nguy hiểm). Thiết kế trong Nexa Chat minh hoạ 4 nguyên tắc an toàn bắt buộc:
1. **Explicit Allowlist (`Map<AllowlistedToolName, ToolHandler>`)**: Chỉ duy nhất `get_current_time` và `count_words` được phép chạy.
2. **Strict Argument Validation**: Từ chối mọi key lạ (`Unexpected argument`), kiểm tra kiểu dữ liệu, kiểm tra múi giờ IANA hợp lệ, giới hạn độ dài chuỗi `count_words`.
3. **Bounded Loop (`MAX_TOOL_ITERATIONS = 3`)**: Chặn vòng lặp vô hạn làm đốt sạch quota.
4. **Full UI Transparency**: Trả mảng `toolExecutions[]` (tên tool, tham số, trạng thái `completed`/`rejected`, kết quả, `durationMs`) để UI hiển thị rõ mô hình đã gọi gì.

### 3. Khái niệm LLM Engineering minh hoạ
- **Tool Declarations**: Mô tả tên, mục đích và JSON Schema tham số của hàm cho Gemini biết khi nào nên gọi.
- **Multi-Turn Tool Loop**: Mô hình không tự chạy code! Mô hình chỉ trả JSON `functionCall` → Backend của bạn chạy code thật → Backend gửi lại `functionResponse` → Mô hình đọc kết quả và viết câu trả lời tự nhiên.

### 4. File và hàm triển khai
- `apps/api/src/features/llm/tools/tool-execution.service.ts`: `getToolDeclarations()`, `isAllowlisted()`, `execute()`, `executeGetCurrentTime()`, `executeCountWords()`.
- `apps/api/src/features/llm/llm-experiments.service.ts`: `runToolPrompt()` (vòng lặp `for (iteration <= MAX_TOOL_ITERATIONS)` cộng dồn `usage` qua từng lượt).
- `apps/api/src/features/llm/providers/gemini/gemini.provider.ts`: `generateWithTools()` (map `functionCall` & `functionResponse` vào `Content.parts`).
- `apps/web/src/features/labs/components/llm-labs-panel.tsx`: hiển thị thẻ trạng thái tool (`Đã thực thi` / `Bị từ chối`, JSON args & result).

### 5. Luồng dữ liệu
```text
User ("Bây giờ là mấy giờ ở Asia/Ho_Chi_Minh?")
  ▼
Lượt 1: Backend gửi [userPrompt] + [toolDeclarations] ──► Gemini
        Gemini trả functionCall: { name: "get_current_time", args: { timezone: "Asia/Ho_Chi_Minh" } }
  ▼
Backend: ToolExecutionService.execute()
        ├─ Kiểm tra allowlist -> OK
        ├─ Validate timezone -> OK
        └─ Thực thi Intl.DateTimeFormat -> { iso, timezone, formatted }
  ▼
Lượt 2: Backend gửi [userPrompt, model(functionCall), user(functionResponse)] ──► Gemini
        Gemini trả text cuối: "Hiện tại ở múi giờ Asia/Ho_Chi_Minh là ..."
  ▼
Trả về UI: { answer, toolExecutions: [...], usage, iterations: 2 }
```

### 6. Lỗi thường gặp
- Thực thi trực tiếp `eval()` hoặc `this[call.name](call.args)` mà không kiểm tra allowlist.
- Không truyền lại kết quả lỗi `{ ok: false, error }` khi tool bị từ chối hoặc thiếu tham số (trả thông báo lỗi có cấu trúc giúp mô hình biết không gọi được và giải thích lịch sự cho người dùng).
- Quên cộng dồn `inputTokens`/`outputTokens` của tất cả các lượt trong vòng lặp.

### 7. Cần hiểu trước khi sửa
- Tính năng này được cố tình tách sang `/api/v1/llm/tools/run` và trang `/labs` để giữ luồng chat chính sạch và dễ học. Không bao giờ cấp quyền chạy truy vấn SQL tự do cho tool của LLM.

### 8. Bài tập thực hành
1. Đọc `apps/api/src/features/llm/tools/tool-execution.service.spec.ts` và `llm-experiments.service.spec.ts` để xem cách test chặn `delete_database`, `eval_code`, múi giờ sai `Mars/Olympus`, và vòng lặp vô hạn.
2. Tự thiết kế trên giấy một allowlisted tool thứ 3 an toàn (ví dụ `convert_temperature` đổi °C ↔ °F): liệt kê JSON Schema tham số và các edge case cần chặn (`NaN`, `Infinity`, key lạ).

### 9. Có thể hoãn học lúc này
- Kết hợp Function Calling song song nhiều tool ngay trong luồng SSE streaming, hoặc kết nối MCP server bên ngoài.

---

## Module 10 — Frontend Package-by-Feature & Safe Markdown UI

### 1. Vấn đề giải quyết
Xây dựng giao diện AI chatbot light-theme chuyên nghiệp, responsive (desktop + mobile) nhưng vẫn tách biệt rõ trách nhiệm giữa route composition, server state, form validation và hiển thị Markdown an toàn.

### 2. Vì sao tồn tại
- **App Router (`src/app/`) chỉ lắp ghép**: các file `page.tsx` chỉ dài 5–20 dòng, gọi lại feature component bên trong `src/features/`.
- **Safe Markdown (`skipHtml`, không `rehype-raw`)**: Output từ LLM có thể chứa thẻ `<script>` hoặc HTML do người dùng cố tình dụ (prompt injection). Tắt raw HTML và lọc URL link chỉ cho phép `http(s):` / `mailto:` giúp chống XSS triệt để.

### 3. File và hàm triển khai
- `apps/web/src/lib/api-client.ts` (`apiRequest` với `credentials: 'include'`), `apps/web/src/lib/env.ts` (Zod validation).
- `apps/web/src/providers/auth-provider.tsx` & `query-provider.tsx`.
- `apps/web/src/components/layout/` (`WorkspaceLayout`, `AppSidebar` thu gọn desktop / drawer mobile, `AppHeader`).
- `apps/web/src/features/chat/components/`: `MarkdownContent`, `MessageBubble`, `MessageList`, `EmptyChatState`, `ChatComposer` (`Enter` gửi, `Shift+Enter` xuống dòng, đếm ký tự, cảnh báo Free Tier privacy).
- `apps/web/src/features/settings/`: `ModelSettingsDialog`, `SettingsPanel` (chỉ chỉnh `temperature` & `maxOutputTokens`, không có chọn model trả phí).

### 4. Bài tập thực hành
1. Chạy `pnpm --filter @nexa-chat/web test` để xem 9 file test Vitest + Testing Library kiểm chứng form auth, composer, streaming hook, nhóm ngày và LLM Labs.
2. Mở `apps/web/src/features/chat/components/markdown-content.tsx` xem cách lọc `safeHref` chặn giao thức `javascript:alert(1)` trong link Markdown do LLM sinh ra.
