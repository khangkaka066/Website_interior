// Nội dung tạm khi trang đang tải, để không bị màn trắng. Màu kem cùng tông giao diện, chuyển động nhẹ và tự tắt khi người dùng chọn giảm chuyển động.
export function PageSpinner({ label = 'Đang tải…' }) {
  return (
    <div className="page-spinner" role="status" aria-live="polite">
      <span className="page-spinner-ring" />
      <span className="page-spinner-label">{label}</span>
    </div>
  )
}

// Khung xương cho trang danh sách (sản phẩm, tin tức...): tiêu đề + lưới thẻ.
export function ShopSkeleton({ cards = 8 }) {
  return (
    <main className="container skeleton-page" aria-busy="true" aria-label="Đang tải">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton-grid">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-thumb" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </main>
  )
}
