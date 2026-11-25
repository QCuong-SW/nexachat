/**
 * Stage 0 — Kiểm tra Argon2id hoạt động ổn định trên môi trường hiện tại (Windows/Linux/macOS).
 */

import argon2 from 'argon2';

async function main() {
  const samplePassword = 'NexaChat_Stage0_Test_Password!';
  const hash = await argon2.hash(samplePassword, {
    type: argon2.argon2id,
  });

  const valid = await argon2.verify(hash, samplePassword);
  const invalid = await argon2.verify(hash, 'wrong-password');

  if (!valid || invalid) {
    console.error('[ARGON2] Xác minh thất bại!');
    process.exit(1);
  }

  console.log('[ARGON2] OK — Argon2id hash & verify hoạt động bình thường.');
  console.log('[ARGON2] Prefix:', hash.slice(0, 30) + '...');
}

main().catch((err: unknown) => {
  console.error('[ARGON2] Lỗi:', err);
  process.exit(1);
});
