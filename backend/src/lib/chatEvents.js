import { EventEmitter } from 'node:events'

// Đẩy sự kiện chat tới trình duyệt theo thời gian thực bằng Server-Sent Events (SSE): máy chủ chỉ báo "có thay đổi ở cuộc trò chuyện X",
// trình duyệt nhận được thì tải lại dữ liệu qua các API sẵn có. Nhờ vậy mất kết nối/bỏ lỡ sự kiện cũng không sai dữ liệu.
// Bộ phát nằm trong bộ nhớ của MỘT tiến trình: chạy nhiều server song song thì sự kiện không sang nhau được
// (khi đó trình duyệt vẫn cập nhật nhờ lần tải lại dự phòng mỗi 30 giây; muốn đầy đủ cần Postgres LISTEN/NOTIFY hoặc Redis).
const bus = new EventEmitter()
bus.setMaxListeners(0)

const MAX_STREAMS = 1000 // tổng số kết nối đang mở
const MAX_PER_CONVERSATION = 5 // một khách mở nhiều tab vẫn đủ, nhưng không bơm kết nối
const HEARTBEAT_MS = 25000

export const ADMIN_CHANNEL = 'admin'
const customerChannel = (conversationId) => `c:${conversationId}`

let open = 0
const perChannel = new Map()

// Báo cho khách của cuộc trò chuyện và toàn bộ admin đang mở hộp thư.
export function publishChat(conversationId, event) {
  const payload = { ...event, conversationId }
  bus.emit(customerChannel(conversationId), payload)
  bus.emit(ADMIN_CHANNEL, payload)
}

// Mở luồng SSE trên `res`. Trả về false nếu quá giới hạn kết nối (caller trả 429).
export function openStream(req, res, channel) {
  const isCustomer = channel !== ADMIN_CHANNEL
  if (open >= MAX_STREAMS || (isCustomer && (perChannel.get(channel) || 0) >= MAX_PER_CONVERSATION)) return false

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx không được gom đệm luồng này
  })
  res.flushHeaders()
  res.write('retry: 3000\n\n')

  open += 1
  perChannel.set(channel, (perChannel.get(channel) || 0) + 1)

  const send = (payload) => res.write(`event: chat\ndata: ${JSON.stringify(payload)}\n\n`)
  bus.on(channel, send)
  const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS) // giữ kết nối sống qua proxy/CDN

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(beat)
    bus.off(channel, send)
    open -= 1
    const left = (perChannel.get(channel) || 1) - 1
    if (left <= 0) perChannel.delete(channel)
    else perChannel.set(channel, left)
  }
  req.on('close', close)
  res.on('error', close)
  return true
}

export { customerChannel }
export const _stats = () => ({ open, channels: perChannel.size })
