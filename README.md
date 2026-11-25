# Nexa Chat — Full-Stack AI Chatbot & LLM Engineering Lab

**Nexa Chat** là ứng dụng AI chatbot full-stack giao diện sáng (light-theme) được xây dựng theo chuẩn kỹ thuật phần mềm thực tế để học **LLM Engineering từ gốc đến ngọn** với **Gemini Developer API Free Tier**.

---

## 1. Tính năng nổi bật

- **Xác thực cục bộ bảo mật:** Đăng ký, đăng nhập, đăng xuất, `/auth/me` với **Argon2id**, JWT lưu trong **HttpOnly cookie (`SameSite=Lax`)**, CORS chuẩn origin và `OriginGuard` chống CSRF.
- **Lịch sử hội thoại bền vững (PostgreSQL 17 + Prisma):** Tạo mới, đổi tên inline, xoá mềm (soft delete), tìm kiếm theo tiêu đề, nhóm theo ngày (*Today / Previous 7 Days / Older*), cô lập tuyệt đối theo `userId`.
- **Gemini Free Tier (`@google/genai`):** Provider adapter (`ILlmProvider` / `GeminiProvider`) cố định model ở backend (`GEMINI_MODEL=gemini-3.5-flash-lite`), không chọn model trả phí từ client, không fallback sang model trả phí, không bật Google Search grounding.
- **Real-time Streaming (SSE):** `POST /api/v1/conversations/:id/messages/stream` kết hợp `fetch` + `ReadableStream` + `parseSseBuffer`, hỗ trợ nút **Dừng** (`AbortController` → lưu `CANCELLED` giữ text đã nhận), **Tạo lại**, **Sao chép**, Markdown an toàn (`skipHtml`) + syntax highlighting.
- **Kiểm soát Context Window & Rate Limit:** `ContextBuilder` giới hạn `MAX_HISTORY_MESSAGES` + `MAX_CONTEXT_CHARS`; `UserRateLimitGuard` giới hạn theo `userId`; tự dọn message `PENDING` mồ côi khi server khởi động.
- **Theo dõi Usage & Độ trễ:** Lưu token thật (không tự bịa số khi thiếu) và tổng hợp tại `/settings` (`GET /api/v1/usage/me`).
- **LLM Engineering Labs (`/labs`, tách riêng khỏi chat chính):**
  - **Structured Output (`POST /api/v1/llm/summarize`):** Tóm tắt `{ title, summary, keyPoints[] }` có validate 2 lớp ở model và backend.
  - **Function Calling an toàn (`POST /api/v1/llm/tools/run`):** Chỉ cho phép 2 hàm backend allowlist (`get_current_time`, `count_words`), tối đa 3 vòng lặp, hiển thị trạng thái thực thi tool trực quan trên UI.

---

## 2. Công nghệ sử dụng

| Tầng | Stack |
|---|---|
| **Frontend (`apps/web`)** | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix), Lucide React, TanStack Query, React Hook Form, Zod, `react-markdown` + `remark-gfm` + `rehype-highlight`, Vitest + Testing Library |
| **Backend (`apps/api`)** | NestJS 11, TypeScript, PostgreSQL 17, Prisma ORM 6, Argon2id, Passport JWT (HttpOnly cookie), `class-validator` / `class-transformer`, `@google/genai`, Jest + Supertest |
| **Hạ tầng** | Docker Compose (PostgreSQL 17), pnpm workspace monorepo |

---

## 3. Tài liệu đọc theo thứ tự khuyến nghị

1. **[docs/LEARNING_GUIDE.md](docs/LEARNING_GUIDE.md)** *(Quan trọng nhất)* — Giải thích 10 module LLM Engineering gắn trực tiếp với từng file, hàm, sơ đồ luồng, lỗi thường gặp và bài tập thực hành.
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Sơ đồ hệ thống, 3 sơ đồ trình tự (Auth, Streaming SSE, Function Calling), Security Threat Model và Ma trận xử lý lỗi.
3. **[docs/API_SPEC.md](docs/API_SPEC.md)** — Chi tiết mọi REST & SSE endpoint, DTO validation, mã lỗi và lệnh `curl` kiểm thử nhanh.
4. **[docs/DATABASE.md](docs/DATABASE.md)** — ERD, cấu trúc bảng, phân tích index, vòng đời trạng thái `MessageStatus` và quy trình migration.

---

## 4. Thiết lập môi trường (Step-by-step)

### Yêu cầu
- Node.js `>= 22`, pnpm `>= 9`
- Docker Desktop (chạy PostgreSQL 17)
- Gemini Developer API Key (Free Tier — tạo miễn phí tại https://aistudio.google.com/apikey)

### Bước 1 — Tạo file `.env` cục bộ (KHÔNG commit lên Git)
```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
```
Mở `.env` và `apps/api/.env`, cập nhật các biến quan trọng:

| Biến môi trường | Ý nghĩa | Giá trị gợi ý (Local Dev) |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Tài khoản PostgreSQL 17 trong Docker | Đặt mật khẩu cục bộ bất kỳ (khớp với `DATABASE_URL`) |
| `DATABASE_URL` | Chuỗi kết nối Prisma cho môi trường dev | `postgresql://nexa_user:<pass>@127.0.0.1:5432/nexa_chat?schema=public` |
| `TEST_DATABASE_URL` | Chuỗi kết nối DB test riêng (`nexa_chat_test`) | `postgresql://nexa_user:<pass>@127.0.0.1:5432/nexa_chat_test?schema=public` |
| `JWT_SECRET` | Khoá ký JWT (tối thiểu 32 ký tự) | Chuỗi ngẫu nhiên ≥ 32 ký tự |
| `CORS_ORIGIN` | Origin chính xác của Next.js | `http://localhost:3000` |
| `GEMINI_API_KEY` | API key Free Tier (chỉ nằm ở backend) | Key lấy từ Google AI Studio |
| `GEMINI_MODEL` | Model ID Free Tier cố định ở backend | `gemini-3.5-flash-lite` |
| `MAX_HISTORY_MESSAGES` / `MAX_CONTEXT_CHARS` | Giới hạn cửa sổ ngữ cảnh gửi cho model | `20` / `32000` |
| `RATE_LIMIT_TTL_MS` / `RATE_LIMIT_MAX_REQUESTS` | Rate limit in-memory theo user | `60000` / `20` |

### Bước 2 — Cài đặt dependencies & khởi động PostgreSQL 17
```powershell
pnpm install
pnpm db:up
```
Kiểm tra PostgreSQL 17 đã sẵn sàng:
```powershell
docker exec nexa-chat-postgres psql -U nexa_user -d nexa_chat -c "SELECT version();"
```

### Bước 3 — Áp dụng Prisma Migration & xác minh Gemini Model
```powershell
pnpm prisma:generate
pnpm --filter @nexa-chat/api prisma:deploy

# Xác minh model GEMINI_MODEL tồn tại trên key Free Tier của bạn (gọi ai.models.list)
pnpm spike:gemini
```

### Bước 4 — Khởi chạy ứng dụng (mở 2 terminal)
```powershell
# Terminal 1 — Backend API (http://localhost:4000/api/v1)
pnpm dev:api

# Terminal 2 — Frontend Web (http://localhost:3000)
pnpm dev:web
```

---

## 5. Danh sách lệnh phát triển & kiểm thử

```powershell
pnpm lint                              # Kiểm tra TypeScript toàn workspace (api + web)
pnpm build                             # Build production (nest build + next build)
pnpm test                              # Chạy toàn bộ unit tests (API Jest + Web Vitest, dùng mock)
pnpm --filter @nexa-chat/api test:e2e  # Chạy Supertest API integration tests (Auth, Ownership, SSE, Labs)
pnpm --filter @nexa-chat/api test:db   # Chạy PostgreSQL 17 DB integration test thật (cần Docker DB)
pnpm --filter @nexa-chat/api verify:argon2  # Xác minh Argon2id native binary
pnpm spike:gemini                      # Chạy spike kiểm tra model Free Tier thật
pnpm db:up / pnpm db:down / pnpm db:logs    # Quản lý container PostgreSQL 17
```

---

## 6. Khắc phục sự cố thường gặp (Troubleshooting)

- **Lỗi `failed to connect to the docker API` khi chạy `pnpm db:up`:** Docker Desktop chưa được bật. Hãy mở ứng dụng Docker Desktop, đợi biểu tượng chuyển sang màu xanh rồi chạy lại `pnpm db:up`.
- **Lỗi `Invalid environment configuration` khi chạy `pnpm dev:api`:** `env.validation.ts` cố tình dừng sớm (fail-fast) nếu thiếu `DATABASE_URL` hoặc `JWT_SECRET` ngắn hơn 32 ký tự. Kiểm tra lại `apps/api/.env`.
- **Cookie đăng nhập không được giữ trên trình duyệt:** Kiểm tra `CORS_ORIGIN` ở backend khớp chính xác với URL bạn đang mở trên trình duyệt (`http://localhost:3000`, không dùng trộn lẫn `127.0.0.1` và `localhost`).
- **Lỗi `429 LLM_QUOTA_EXCEEDED` hoặc `LLM_RATE_LIMITED`:** Tài khoản Free Tier đã chạm trần RPM/TPM/RPD theo Google Cloud project. Kiểm tra hạn mức trực tiếp tại https://aistudio.google.com/rate-limit.
- **Lỗi `pnpm spike:gemini` báo không tìm thấy `gemini-3.5-flash-lite`:** Script sẽ in danh sách các model Flash/Flash-Lite khả dụng trên tài khoản của bạn và dừng an toàn (không tự fallback sang model trả phí). Hãy cập nhật `GEMINI_MODEL` sang một model Free Tier hợp lệ được liệt kê.

---

## 7. Lưu ý Quyền riêng tư & Free Tier

- Ứng dụng chỉ dùng **Gemini Developer API Free Tier** và không tự động chuyển sang model trả phí.
- Dữ liệu gửi lên Gemini Free Tier có thể được Google sử dụng để cải thiện sản phẩm và được con người xem xét. **Tuyệt đối không nhập mật khẩu, thông tin cá nhân nhạy cảm (CCCD, thẻ ngân hàng) hay tài liệu bí mật** vào ứng dụng.
