import { API_BASE, getToken } from '../api'

// Nhận sự kiện thời gian thực (Server-Sent Events) từ backend. Dùng fetch thay vì EventSource để gửi được header Authorization
// (luồng của admin cần đăng nhập). Tự nối lại khi mất kết nối (chờ 1s, tăng dần tới 15s). Mỗi lần (nối lại) kết nối xong
// sẽ gọi onEvent({ type: 'open' }) để nơi dùng tải lại dữ liệu, bù cho những sự kiện đã bỏ lỡ.
// Trả về hàm đóng luồng.
export function openEventStream(path, onEvent) {
  let stopped = false
  let ctl = null
  let delay = 1000

  async function run() {
    while (!stopped) {
      ctl = new AbortController()
      try {
        const token = getToken()
        const res = await fetch(`${API_BASE}/api${path}`, {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctl.signal,
        })
        // Không có quyền / không tồn tại thì nối lại cũng vô ích.
        if (res.status === 401 || res.status === 403 || res.status === 404) return
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        delay = 1000
        onEvent({ type: 'open' })

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const line = block.split('\n').find((l) => l.startsWith('data: '))
            if (line) {
              try {
                onEvent(JSON.parse(line.slice(6)))
              } catch {
                // bỏ qua khối dữ liệu hỏng
              }
            }
          }
        }
      } catch {
        // mất mạng / server khởi động lại: nối lại bên dưới
      }
      if (stopped) return
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, 15000)
    }
  }

  run()
  return () => {
    stopped = true
    ctl?.abort()
  }
}
