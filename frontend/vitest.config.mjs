import { defineConfig } from 'vitest/config'

// Kiểm thử các module thuần của giao diện (tìm kiếm, cảnh báo giá, nhập Excel, luồng sự kiện chat).
export default defineConfig({
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
  test: { include: ['ui/__tests__/**/*.test.js'] },
})
