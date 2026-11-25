/**
 * Stage 0 — Gemini Spike Script (KHÔNG thuộc kiến trúc ứng dụng chính)
 *
 * Mục tiêu:
 * 1. Kiểm tra một lời gọi SDK @google/genai tối thiểu trước khi bọc vào kiến trúc NestJS.
 * 2. Gọi ai.models.list() để xác minh model GEMINI_MODEL có tồn tại trên tài khoản Free Tier hay không.
 * 3. Nếu tồn tại, gọi generateContent() một câu và in ra usageMetadata (input/output tokens).
 *
 * Quy tắc an toàn:
 * - Không bao giờ in GEMINI_API_KEY ra console.
 * - Không tự động fallback sang model khác nếu model cấu hình không tồn tại.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const targetModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error(
      '[SPIKE] Thiếu GEMINI_API_KEY thật trong .env hoặc biến môi trường.\n' +
        'Hãy lấy Free Tier API key tại https://aistudio.google.com/apikey và cấu hình GEMINI_API_KEY rồi chạy lại:\n' +
        '  pnpm spike:gemini',
    );
    process.exit(2);
  }

  console.log(`[SPIKE] Đang kiểm tra model mục tiêu: "${targetModel}"`);

  const ai = new GoogleGenAI({ apiKey });

  // Bước 1: Liệt kê các model khả dụng để xác minh model ID
  const availableNames: string[] = [];
  const pager = await ai.models.list();
  for await (const model of pager) {
    if (model.name) {
      availableNames.push(model.name);
    }
  }

  const normalizedTarget = targetModel.startsWith('models/')
    ? targetModel
    : `models/${targetModel}`;

  const matched = availableNames.find(
    (name) => name === targetModel || name === normalizedTarget,
  );

  const flashLiteCandidates = availableNames.filter((n) =>
    n.toLowerCase().includes('flash-lite') || n.toLowerCase().includes('flash'),
  );

  console.log(`[SPIKE] Tổng số model tài khoản nhìn thấy: ${availableNames.length}`);
  if (flashLiteCandidates.length > 0) {
    console.log('[SPIKE] Một số model Flash/Flash-Lite khả dụng:');
    for (const candidate of flashLiteCandidates.slice(0, 15)) {
      console.log(`  - ${candidate}`);
    }
  }

  if (!matched) {
    console.error(
      `\n[SPIKE] KHÔNG TÌM THẤY model "${targetModel}" trong danh sách model khả dụng.\n` +
        'Theo quy tắc dự án, không tự động fallback sang model khác. Hãy chọn model Free Tier phù hợp và cập nhật GEMINI_MODEL.',
    );
    process.exit(3);
  }

  console.log(`\n[SPIKE] Đã xác nhận model tồn tại: ${matched}`);

  // Bước 2: Gửi thử 1 prompt ngắn để xem response và usageMetadata
  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: targetModel,
    contents: 'Trả lời ngắn gọn trong 1 câu: LLM là gì?',
  });
  const elapsedMs = Date.now() - startedAt;

  console.log('\n[SPIKE] Phản hồi từ Gemini:');
  console.log(response.text ?? '(không có text)');
  console.log('\n[SPIKE] Usage Metadata:', JSON.stringify(response.usageMetadata ?? null, null, 2));
  console.log(`[SPIKE] Độ trễ (latency): ${elapsedMs} ms`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[SPIKE] Lỗi khi gọi Gemini API:', message);
  process.exit(1);
});
