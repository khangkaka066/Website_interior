import 'dotenv/config'
import app from './app.js'
import { loadProducts, startProductRefresh } from './lib/productStore.js'

const PORT = process.env.PORT || 4000

// Production: bắt buộc JWT_SECRET đủ mạnh (token đăng nhập ký bằng khóa này; khóa yếu = giả mạo được tài khoản admin).
if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET || '').length < 32) {
  console.error('JWT_SECRET thiếu hoặc quá ngắn (cần >= 32 ký tự) khi chạy production.')
  process.exit(1)
}

// Nạp sản phẩm từ database trước khi nhận đơn; lỗi thì dùng danh sách tĩnh và thử lại định kỳ.
await loadProducts().catch((err) => console.warn('Chưa nạp được sản phẩm từ database, dùng danh sách tĩnh:', err.message))
startProductRefresh()

app.listen(PORT, () => {
  console.log(`Clevinum backend listening on http://localhost:${PORT}`)
})
