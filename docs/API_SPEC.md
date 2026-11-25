# API Specification — Nexa Chat

- **Base URL (local dev):** `http://localhost:4000/api/v1`
- **Định dạng dữ liệu:** JSON (`application/json`), riêng endpoint streaming dùng `text/event-stream; charset=utf-8`.
- **Xác thực:** JWT lưu trong cookie `HttpOnly; SameSite=Lax` (mặc định `COOKIE_NAME=nexa_session`, thêm `Secure` khi `NODE_ENV=production`). Trình duyệt bắt buộc gửi kèm `credentials: 'include'`.
- **Chống CSRF (`OriginGuard`):** Mọi request `POST`, `PUT`, `PATCH`, `DELETE` đều phải có `Origin` / `Referer` khớp `CORS_ORIGIN` và không được mang `Sec-Fetch-Site: cross-site`.
- **Validation toàn cục (`ValidationPipe`):** `whitelist: true` + `forbidNonWhitelisted: true` — mọi trường thừa không khai báo trong DTO (ví dụ cố gửi `model` hoặc `role`) đều bị từ chối với `400 VALIDATION_ERROR`.

---

## 1. Cấu trúc lỗi chuẩn & Danh mục mã lỗi

Mọi lỗi đều được `HttpExceptionFilter` chuẩn hoá về cùng một cấu trúc (không bao giờ trả stack trace hay API key):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": [
      "email must be an email",
      "password must be longer than or equal to 8 characters"
    ]
  }
}
```

| Mã lỗi (`error.code`) | HTTP Status | Nguyên nhân | Có nên Retry? |
|---|---|---|---|
| `VALIDATION_ERROR` | `400` | Sai kiểu dữ liệu, thiếu field hoặc gửi field lạ không cho phép | Không (sửa input) |
| `EMPTY_MESSAGE` / `MESSAGE_TOO_LONG` | `400` | Tin nhắn rỗng hoặc vượt `MAX_INPUT_CHARS` (mặc định 8000) | Không (rút gọn tin) |
| `UNAUTHORIZED` | `401` | Thiếu cookie phiên đăng nhập hoặc JWT hết hạn/không hợp lệ | Đăng nhập lại |
| `INVALID_CREDENTIALS` | `401` | Sai email hoặc sai mật khẩu (cố tình trả thông báo giống nhau) | Không |
| `INVALID_ORIGIN` | `403` | `Origin` / `Referer` không khớp `CORS_ORIGIN` hoặc `Sec-Fetch-Site: cross-site` | Không |
| `CONVERSATION_NOT_FOUND` | `404` | Hội thoại không tồn tại, đã soft-delete hoặc thuộc user khác | Không |
| `EMAIL_ALREADY_EXISTS` | `409` | Email đăng ký đã tồn tại (sau khi chuẩn hoá lowercase) | Không |
| `RATE_LIMITED` | `429` | Vượt giới hạn request/phút của user (`UserRateLimitGuard`, kèm header `Retry-After`) | Có (sau `Retry-After`) |
| `LLM_QUOTA_EXCEEDED` | `429` | Đạt trần quota Gemini Free Tier của Google Cloud project | Có (khi quota reset) |
| `LLM_RATE_LIMITED` | `429` | Vượt RPM/TPM của Gemini Free Tier | Có (sau vài giây) |
| `LLM_INVALID_API_KEY` | `502` | `GEMINI_API_KEY` sai hoặc bị thu hồi | Quản trị viên sửa `.env` |
| `LLM_INVALID_OUTPUT` | `502` | JSON Structured Output sai schema hoặc vượt quá 3 vòng gọi tool | Có |
| `LLM_NETWORK_ERROR` | `502` | Đứt kết nối mạng tới máy chủ Gemini | Có |
| `LLM_API_KEY_MISSING` | `503` | Backend chưa cấu hình `GEMINI_API_KEY` | Quản trị viên sửa `.env` |
| `LLM_UNAVAILABLE` | `503` | Dịch vụ Gemini quá tải hoặc trả 5xx | Có |
| `LLM_TIMEOUT` | `504` | Quá 30 giây không nhận được phản hồi từ Gemini | Có |

---

## 2. Health

### `GET /api/v1/health` *(Public)*
Kiểm tra dịch vụ API đang hoạt động.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "nexa-chat-api",
  "timestamp": "2026-11-23T04:00:00.000Z"
}
```

---

## 3. Authentication

### `POST /api/v1/auth/register` *(Public)*
Tạo tài khoản mới, băm mật khẩu bằng **Argon2id**, chuẩn hoá email (`trim().toLowerCase()`), gắn HttpOnly session cookie.

| Trường | Kiểu | Ràng buộc (`RegisterDto`) |
|---|---|---|
| `email` | `string` | Email hợp lệ, tối đa 255 ký tự, tự `trim().toLowerCase()` |
| `password` | `string` | Từ 8 đến 128 ký tự |
| `displayName` | `string` | Từ 2 đến 80 ký tự, tự `trim()` |

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "StrongPassword123!",
  "displayName": "Alice Nguyen"
}
```

**Response `201 Created`** *(kèm `Set-Cookie: nexa_session=<jwt>; Path=/; HttpOnly; SameSite=Lax`)*:
```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "alice@example.com",
    "displayName": "Alice Nguyen",
    "createdAt": "2026-11-23T04:00:00.000Z",
    "updatedAt": "2026-11-23T04:00:00.000Z"
  }
}
```
*(Trường `passwordHash` không bao giờ xuất hiện trong bất kỳ response nào.)*

### `POST /api/v1/auth/login` *(Public)*
- **Request:** `{ "email": "alice@example.com", "password": "StrongPassword123!" }`
- **Response `200 OK`:** `{ "user": { ... } }` + `Set-Cookie` (`HttpOnly; SameSite=Lax`).
- **Response `401`:** `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }`.

### `POST /api/v1/auth/logout` *(Public / Authenticated)*
Xoá cookie `nexa_session` với cùng `httpOnly`, `sameSite`, `secure`, `path`.
- **Response `200 OK`:** `{ "success": true }`.

### `GET /api/v1/auth/me` *(Yêu cầu đăng nhập)*
- **Response `200 OK`:** `{ "user": { ... } }`.
- **Response `401`:** nếu thiếu/sai cookie.

---

## 4. Conversation Management *(Yêu cầu đăng nhập — cô lập theo `userId`)*

### `GET /api/v1/conversations`
Lấy danh sách hội thoại chưa bị soft-delete của user hiện tại, sắp xếp theo `lastMessageAt DESC, id DESC`.

| Query Param | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `search` | `string` | — | Tìm theo `title` (`ILIKE`), tối đa 100 ký tự |
| `limit` | `int` | `30` | `1` – `100` |
| `cursor` | `uuid` | — | ID phần tử cuối trang trước để tải trang kế |

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "userId": "11111111-1111-4111-8111-111111111111",
      "title": "Giải thích Context Window trong LLM",
      "createdAt": "2026-11-23T04:01:00.000Z",
      "updatedAt": "2026-11-23T04:05:00.000Z",
      "lastMessageAt": "2026-11-23T04:05:00.000Z",
      "deletedAt": null
    }
  ],
  "nextCursor": null
}
```

### `POST /api/v1/conversations`
- **Request:** `{ "title"?: "1–200 chars" }` (bỏ trống sẽ dùng mặc định `"Cuộc trò chuyện mới"`).
- **Response `201 Created`:** `{ "conversation": { ... } }`.

### `GET /api/v1/conversations/:id/messages`
Lấy lịch sử tin nhắn của hội thoại theo thứ tự thời gian tăng dần (`createdAt ASC, id ASC`).
- **Path Param:** `id` (UUID hợp lệ, sai định dạng trả `400`).
- **Query Params:** `limit` (`1`–`100`, mặc định `50`), `cursor` (UUID).
- **Response `200 OK`:**
```json
{
  "conversation": { "id": "...", "title": "...", "lastMessageAt": "..." },
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "conversationId": "22222222-2222-4222-8222-222222222222",
      "role": "USER",
      "content": "Context window là gì?",
      "status": "COMPLETED",
      "model": null,
      "inputTokens": null,
      "outputTokens": null,
      "finishReason": null,
      "metadata": null,
      "createdAt": "2026-11-23T04:02:00.000Z"
    },
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "conversationId": "22222222-2222-4222-8222-222222222222",
      "role": "ASSISTANT",
      "content": "Context window là tổng lượng token...",
      "status": "COMPLETED",
      "model": "gemini-3.5-flash-lite",
      "inputTokens": 24,
      "outputTokens": 86,
      "finishReason": "STOP",
      "metadata": { "durationMs": 310, "contextMessagesUsed": 1 },
      "createdAt": "2026-11-23T04:02:01.000Z"
    }
  ],
  "nextCursor": null
}
```
- **Response `404`:** nếu hội thoại không tồn tại, đã xoá, hoặc thuộc user khác.

### `PATCH /api/v1/conversations/:id`
- **Request:** `{ "title": "Tiêu đề mới (1–200 chars)" }`
- **Response `200 OK`:** `{ "conversation": { ... } }`.

### `DELETE /api/v1/conversations/:id`
Soft-delete (`deletedAt = now()`).
- **Response `200 OK`:** `{ "success": true }`.

---

## 5. Chat AI & Streaming *(Yêu cầu đăng nhập + `UserRateLimitGuard`)*

### `POST /api/v1/conversations/:id/messages/stream` *(Server-Sent Events)*

| Trường Body | Kiểu | Ràng buộc (`SendMessageDto`) |
|---|---|---|
| `content` | `string` | Bắt buộc, không rỗng sau `trim()`, tối đa `MAX_INPUT_CHARS` (mặc định 8000) |
| `config.temperature` | `number` | Tuỳ chọn, `0` – `2` |
| `config.maxOutputTokens` | `int` | Tuỳ chọn, `64` – `8192` |

> **Cấm chọn model từ client:** Gửi thêm trường `model` sẽ bị từ chối với `400 VALIDATION_ERROR`.

**Response Headers (`200 OK`):**
```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

**Định dạng khung SSE (Wire Format):**
```text
event: message.started
data: {"conversationId":"2222...","userMessageId":"3333...","assistantMessageId":"4444...","model":"gemini-3.5-flash-lite","conversationTitle":"Context window là gì?"}

event: message.delta
data: {"assistantMessageId":"4444...","delta":"Context window là "}

event: message.delta
data: {"assistantMessageId":"4444...","delta":"tổng lượng token tối đa..."}

event: message.completed
data: {"assistantMessageId":"4444...","content":"Context window là tổng lượng token tối đa...","model":"gemini-3.5-flash-lite","inputTokens":24,"outputTokens":86,"finishReason":"STOP","durationMs":310}
```

**Khi xảy ra lỗi giữa stream:**
```text
event: message.error
data: {"assistantMessageId":"4444...","code":"LLM_QUOTA_EXCEEDED","message":"Hạn mức Gemini Free Tier đã đạt giới hạn. Vui lòng đợi hạn mức đặt lại rồi thử lại."}
```

### `POST /api/v1/conversations/:id/messages` *(Non-Streaming)*
Giống body của endpoint stream, trả JSON một lần sau khi hoàn tất:
- **Response `201 Created`:** `{ "userMessage": Message, "assistantMessage": Message }`.

---

## 6. LLM Learning Extensions *(Yêu cầu đăng nhập + `UserRateLimitGuard`)*

### `POST /api/v1/llm/summarize` *(Structured Output)*
- **Request:** `{ "text": "Văn bản từ 10 đến 12.000 ký tự...", "config"?: { "temperature"?, "maxOutputTokens"? } }`
- **Response `200 OK`:**
```json
{
  "result": {
    "title": "Tổng quan kiến trúc Nexa Chat",
    "summary": "Nexa Chat dùng NestJS, Next.js App Router và PostgreSQL 17 kết nối Gemini Free Tier.",
    "keyPoints": [
      "Tổ chức package-by-feature ở cả backend và frontend",
      "Xác thực bằng Argon2id và JWT trong HttpOnly cookie"
    ]
  },
  "model": "gemini-3.5-flash-lite",
  "usage": { "inputTokens": 45, "outputTokens": 38 },
  "durationMs": 220
}
```

### `POST /api/v1/llm/tools/run` *(Allowlisted Function Calling)*
- **Request:** `{ "prompt": "Bây giờ là mấy giờ ở Asia/Ho_Chi_Minh? (1–4000 chars)", "config"?: { ... } }`
- **Allowlist backend:** chỉ `get_current_time` (`timezone?: string`) và `count_words` (`text: string`). Tối đa 3 vòng lặp.
- **Response `200 OK`:**
```json
{
  "answer": "Hiện tại theo múi giờ Asia/Ho_Chi_Minh là ...",
  "toolExecutions": [
    {
      "toolName": "get_current_time",
      "args": { "timezone": "Asia/Ho_Chi_Minh" },
      "status": "completed",
      "result": {
        "iso": "2026-11-23T04:30:00.000Z",
        "timezone": "Asia/Ho_Chi_Minh",
        "formatted": "Monday, 23 November 2026 at 11:30:00 GMT+7"
      },
      "durationMs": 2
    }
  ],
  "model": "gemini-3.5-flash-lite",
  "usage": { "inputTokens": 92, "outputTokens": 28 },
  "iterations": 2,
  "durationMs": 295
}
```

---

## 7. Usage *(Yêu cầu đăng nhập)*

### `GET /api/v1/usage/me`
**Response `200 OK`:**
```json
{
  "model": "gemini-3.5-flash-lite",
  "modelDisplayName": "Gemini 3.5 Flash-Lite — Free Tier",
  "freeTierNotice": "Sử dụng Gemini Developer API Free Tier. Hạn mức RPM/TPM/RPD bị giới hạn theo project và đặt lại định kỳ.",
  "totals": {
    "assistantMessages": 10,
    "completedMessages": 8,
    "failedMessages": 1,
    "cancelledMessages": 1,
    "inputTokens": 420,
    "outputTokens": 980,
    "totalTokens": 1400,
    "messagesWithTokenData": 8,
    "averageDurationMs": 310
  }
}
```

---

## 8. Bộ lệnh `curl` kiểm thử nhanh (Local Dev)

```bash
# 1. Kiểm tra health
curl -s http://localhost:4000/api/v1/health

# 2. Đăng ký & lưu HttpOnly cookie vào file cookies.txt
curl -i -c cookies.txt -X POST http://localhost:4000/api/v1/auth/register \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"StrongPassword123!","displayName":"Demo"}'

# 3. Kiểm tra /auth/me bằng cookie vừa nhận
curl -s -b cookies.txt http://localhost:4000/api/v1/auth/me

# 4. Tạo hội thoại mới
curl -s -b cookies.txt -X POST http://localhost:4000/api/v1/conversations \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. Stream SSE (thay <CONV_ID> bằng UUID vừa tạo, cờ -N tắt buffer của curl)
curl -N -b cookies.txt -X POST "http://localhost:4000/api/v1/conversations/<CONV_ID>/messages/stream" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"Giải thích token trong LLM trong 2 câu","config":{"temperature":0.4,"maxOutputTokens":256}}'

# 6. Kiểm tra Usage
curl -s -b cookies.txt http://localhost:4000/api/v1/usage/me
```
