// Khi chuyển trang bằng link (không tải lại), trang chủ hiện khung chờ rồi nội dung và ảnh tải về dần, nên chiều cao trang đổi SAU khi
// ScrollTrigger đã đo vị trí ghim/cuộn ngang. Không đo lại thì hiệu ứng lệch chỗ cho tới khi tải lại trang.
// Hàm này đo lại (có trì hoãn) mỗi khi chiều cao trang đổi hoặc ảnh tải xong; trả về hàm dừng theo dõi.
export function watchLayout(ScrollTrigger) {
  let last = document.documentElement.scrollHeight
  let timer
  const refresh = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const h = document.documentElement.scrollHeight
      if (Math.abs(h - last) > 2) {
        last = h
        ScrollTrigger.refresh()
      }
    }, 200)
  }
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh)
  ro?.observe(document.body)
  window.addEventListener('load', refresh)
  document.addEventListener('load', refresh, true) // ảnh tải xong (sự kiện load không nổi bọt nên bắt ở pha capture)
  return () => {
    clearTimeout(timer)
    ro?.disconnect()
    window.removeEventListener('load', refresh)
    document.removeEventListener('load', refresh, true)
  }
}
