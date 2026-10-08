import { fetchSiteContent } from '@/lib/api'

// Dùng chung cho 3 trang: lấy dữ liệu, lỗi thì trả null để trang tự hiện thông báo thay vì sập.
export async function loadSite() {
  try {
    return await fetchSiteContent()
  } catch {
    return null
  }
}

export function SiteError() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Chưa mở được trang này</h1>
        <p className="mt-2 text-muted">Vui lòng thử lại sau ít phút.</p>
      </div>
    </main>
  )
}
