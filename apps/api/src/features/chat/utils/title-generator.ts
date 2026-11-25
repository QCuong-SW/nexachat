/**
 * Tạo tiêu đề hội thoại mang tính tất định (deterministic) từ tin nhắn đầu tiên.
 * Không gọi thêm Gemini API chỉ để tạo tiêu đề nhằm tiết kiệm hạn mức Free Tier.
 */
export function generateDeterministicTitle(
  firstMessage: string,
  maxLength = 50,
): string {
  const cleaned = firstMessage
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Cuộc trò chuyện mới';
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(' ');
  const candidate = lastSpace > maxLength * 0.5 ? sliced.slice(0, lastSpace) : sliced;
  return `${candidate.trimEnd()}...`;
}
