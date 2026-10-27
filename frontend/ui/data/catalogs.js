// Catalog (PDF) các mẫu đặt riêng theo yêu cầu: không phải sản phẩm bán sẵn trong kho, khách xem mẫu rồi liên hệ đặt làm riêng.
// Mỗi PDF đã được chuyển sẵn thành ảnh từng trang (public/catalogs/<slug>/page-XX.jpg) để hiện kiểu lật sách trên web mà không cần
// tải PDF gốc nặng hoặc chạy pdf.js ở trình duyệt khách. Tạo lại ảnh bằng: `pdftoppm -jpeg -r 150 -jpegopt quality=82 "<file.pdf>" public/catalogs/<slug>/page`.

const pages = (slug, count) => Array.from({ length: count }, (_, i) => `/catalogs/${slug}/page-${String(i + 1).padStart(2, '0')}.jpg`)

export const CATALOGS = [
  {
    slug: 'cau-vong-blinds',
    title: 'Màn Sáo Lá Dọc – Cầu Vồng Blinds',
    description: 'Catalog mẫu màn sáo lá dọc (vertical blinds) Cầu Vồng: 51 trang mẫu vải, màu và cách phối.',
    width: 620, // trang ảnh ngang (1240x878) -> khung sách cũng để ngang, tránh viền trắng thừa khi lật
    height: 439,
    pages: pages('cau-vong-blinds', 51),
  },
  {
    slug: 'vh-blinds-rem-cuon',
    title: 'Rèm Cuốn VH Blinds',
    description: 'Catalog mẫu rèm cuốn VH Blinds: 12 trang mẫu vải và màu sắc.',
    width: 480, // trang ảnh dọc (874x1241)
    height: 682,
    pages: pages('vh-blinds-rem-cuon', 12),
  },
]

export const catalogBySlug = (slug) => CATALOGS.find((c) => c.slug === slug) || null
