// Lĩnh vực hoạt động / nhóm sản phẩm của CLEVI INTERIOR (theo danh thiếp). Dùng chung cho menu "Sản phẩm", trang Giới thiệu và form Liên hệ.
// Nhóm có `categoryId` dẫn tới danh mục sản phẩm tương ứng (admin gán sản phẩm vào danh mục đó); nhóm `curtain` gom các danh mục rèm có sẵn.

export const CURTAIN_CATEGORIES = [
  { id: 'dan-tuong', name: 'Rèm Dán Tường & RIDO móc' },
  { id: 'chong-nang', name: 'Rèm Ore' },
  { id: 'voan-lua', name: 'Rèm Voan Lụa' },
  { id: 'thanh-treo', name: 'Thanh Treo Rèm' },
  { id: 'rem-khac', name: 'Rèm Khác' },
]

export const PRODUCT_GROUPS = [
  {
    id: 'curtain',
    title: 'Rèm cửa, đệm gối sofa, khăn bàn',
    items: ['Rèm cửa', 'Đệm gối sofa', 'Khăn bàn'],
    href: '/products',
  },
  {
    id: 'vat-lieu',
    title: 'Sơn tường & vật liệu ốp',
    items: ['Sơn tường', 'Trần vách thạch cao', 'PU foam', 'Lam sóng', 'Than tre', 'Sàn giả gỗ'],
    categoryId: 'vat-lieu',
    href: '/products?category=vat-lieu',
  },
  {
    id: 'bang-hieu-den',
    title: 'Bảng hiệu, decal & đèn LED',
    items: ['Bảng hiệu', 'Decal', 'Đèn LED trang trí chiếu sáng'],
    categoryId: 'bang-hieu-den',
    href: '/products?category=bang-hieu-den',
  },
  {
    id: 'do-go',
    title: 'Đồ gỗ nội thất',
    items: ['Đồ gỗ gia dụng', 'Đồ gỗ trang trí nội thất'],
    categoryId: 'do-go',
    href: '/products?category=do-go',
  },
]

export const SERVICES = [
  { id: 'thiet-ke', title: 'Thiết kế nội thất, ngoại thất hiện đại' },
  { id: 'ai', title: 'Ứng dụng AI, chuyển đổi số' },
]

// Toàn bộ lĩnh vực (đúng thứ tự trên danh thiếp) cho trang Giới thiệu và chủ đề của form Liên hệ.
export const BUSINESS_AREAS = [
  'Thiết kế nội thất, ngoại thất hiện đại',
  'Ứng dụng AI, chuyển đổi số',
  'Cung cấp đệm gối sofa, khăn bàn, rèm cửa',
  'Cung cấp sơn tường, trần vách thạch cao, PU foam, lam sóng, than tre, sàn giả gỗ',
  'Cung cấp bảng hiệu, decal, đèn LED trang trí chiếu sáng',
  'Cung cấp đồ gỗ gia dụng, đồ gỗ trang trí nội thất',
]

// Danh mục chưa có sản phẩm: thông báo thân thiện + mời liên hệ báo giá thay vì trang trống.
export const CATEGORY_NOTES = {
  'vat-lieu': 'Sơn tường, trần vách thạch cao, PU foam, lam sóng, than tre, sàn giả gỗ',
  'bang-hieu-den': 'Bảng hiệu, decal, đèn LED trang trí chiếu sáng',
  'do-go': 'Đồ gỗ gia dụng, đồ gỗ trang trí nội thất',
}
