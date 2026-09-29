// Illustrative operational data for the admin dashboard demo. There is no
// real order/inventory backend yet, so everything here (revenue over time,
// order statuses, funnel, AI insights, per-period product stats...) is
// clearly-labeled sample data — only product names/prices/ratings trace
// back to the real Shopee shop (see data/shop.js).

export const timeRanges = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: 'month', label: 'Tháng này' },
  { id: 'custom', label: 'Tùy chỉnh' },
]

export const kpis = [
  {
    id: 'revenue',
    label: 'Doanh thu',
    value: '284.500.000đ',
    change: 18.2,
    icon: 'revenue',
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    value: '1.284',
    change: 9.4,
    icon: 'orders',
  },
  {
    id: 'aov',
    label: 'Giá trị đơn TB (AOV)',
    value: '221.500đ',
    change: 3.1,
    icon: 'aov',
  },
  {
    id: 'customers',
    label: 'Khách hàng',
    value: '946',
    change: 12.7,
    icon: 'customers',
  },
  {
    id: 'conversion',
    label: 'Tỷ lệ chuyển đổi',
    value: '3.8%',
    change: -12.0,
    icon: 'conversion',
  },
]

export const revenueSeries = {
  categories: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
  revenue: {
    current: [18, 22, 20, 26, 24, 30, 28, 34, 32, 38, 36, 42],
    previous: [15, 18, 17, 21, 20, 24, 23, 27, 26, 30, 29, 33],
  },
  orders: {
    current: [90, 104, 98, 118, 112, 136, 128, 152, 145, 168, 160, 184],
    previous: [78, 88, 84, 100, 96, 114, 108, 128, 122, 140, 134, 152],
  },
}

export const orderStatuses = [
  { id: 'unpaid', label: 'Chờ thanh toán', count: 42, color: '#a89685' },
  { id: 'processing', label: 'Đang xử lý', count: 118, color: '#3aa0c9' },
  { id: 'ready', label: 'Chờ giao', count: 76, color: '#e0a559' },
  { id: 'shipping', label: 'Đang vận chuyển', count: 154, color: '#b5602f' },
  { id: 'delivered', label: 'Đã giao', count: 812, color: '#3e8e4f' },
  { id: 'cancelled', label: 'Đã hủy', count: 38, color: '#d14343' },
  { id: 'returned', label: 'Đã trả hàng', count: 14, color: '#8f4a24' },
]

export const topProducts = [
  {
    id: 'p3',
    category: 'Rèm Cửa Chống Nắng',
    sold: 214,
    revenue: '32.950.000đ',
    stock: 86,
    trend: 24,
  },
  {
    id: 'p1',
    category: 'Rèm Cửa Chống Nắng',
    sold: 176,
    revenue: '40.200.000đ',
    stock: 54,
    trend: 12,
  },
  {
    id: 'p7',
    category: 'Phụ kiện',
    sold: 163,
    revenue: '21.520.000đ',
    stock: 9,
    trend: 31,
  },
  {
    id: 'p6',
    category: 'Rèm Cửa Chống Nắng',
    sold: 98,
    revenue: '32.100.000đ',
    stock: 21,
    trend: -6,
  },
  {
    id: 'p5',
    category: 'Thanh Treo Rèm',
    sold: 87,
    revenue: '9.300.000đ',
    stock: 0,
    trend: -14,
  },
]

export const inventoryAlerts = [
  { id: 'p7', stock: 9, status: 'low' },
  { id: 'p5', stock: 0, status: 'out' },
  { id: 'p3', stock: 6, status: 'low' },
]

export const customerOverview = {
  newCustomers: 312,
  returningCustomers: 634,
  totalCustomers: 946,
  returningRate: 67,
}

export const salesByCategory = [
  { name: 'Rèm Cửa Chống Nắng', value: 42 },
  { name: 'Rèm Dán Tường', value: 24 },
  { name: 'Rèm Voan Lụa', value: 18 },
  { name: 'Thanh Treo Rèm', value: 10 },
  { name: 'Phụ kiện', value: 6 },
]

export const conversionFunnel = [
  { id: 'visitors', label: 'Lượt truy cập', value: 24800 },
  { id: 'views', label: 'Xem sản phẩm', value: 14200 },
  { id: 'cart', label: 'Thêm giỏ hàng', value: 4600 },
  { id: 'checkout', label: 'Vào thanh toán', value: 2100 },
  { id: 'payment', label: 'Thanh toán thành công', value: 1450 },
  { id: 'completed', label: 'Đơn hàng hoàn tất', value: 1284 },
]

export const recentOrders = [
  {
    id: '#CLV-10231',
    customer: 'Nguyễn Thị Hạnh',
    total: '458.000đ',
    payment: 'Đã thanh toán',
    status: 'Đang vận chuyển',
    time: '5 phút trước',
  },
  {
    id: '#CLV-10230',
    customer: 'Trần Văn Long',
    total: '221.760đ',
    payment: 'Đã thanh toán',
    status: 'Đang xử lý',
    time: '18 phút trước',
  },
  {
    id: '#CLV-10229',
    customer: 'Phạm Thu Trang',
    total: '691.200đ',
    payment: 'Chờ thanh toán',
    status: 'Chờ thanh toán',
    time: '42 phút trước',
  },
  {
    id: '#CLV-10228',
    customer: 'Lê Minh Khôi',
    total: '153.984đ',
    payment: 'Đã thanh toán',
    status: 'Đã giao',
    time: '1 giờ trước',
  },
  {
    id: '#CLV-10227',
    customer: 'Hoàng Bảo Ngọc',
    total: '327.618đ',
    payment: 'Đã thanh toán',
    status: 'Đang vận chuyển',
    time: '2 giờ trước',
  },
  {
    id: '#CLV-10226',
    customer: 'Đỗ Anh Tuấn',
    total: '132.045đ',
    payment: 'Đã thanh toán',
    status: 'Đã hủy',
    time: '3 giờ trước',
  },
  {
    id: '#CLV-10225',
    customer: 'Vũ Thị Mai',
    total: '264.090đ',
    payment: 'Đã thanh toán',
    status: 'Đã giao',
    time: '5 giờ trước',
  },
]

export const aiInsights = [
  {
    id: 1,
    type: 'positive',
    text: 'Doanh thu tăng 18% so với tuần trước, chủ yếu nhờ nhóm Rèm Cửa Chống Nắng.',
  },
  {
    id: 2,
    type: 'positive',
    text: '"Gối tựa sofa vải gấm" đang có tốc độ bán tăng mạnh (+31% so với kỳ trước).',
  },
  {
    id: 3,
    type: 'warning',
    text: '"Thanh treo rèm cao cấp giá xưởng" đã hết hàng — có nguy cơ mất đơn trong 5 ngày tới.',
  },
  {
    id: 4,
    type: 'warning',
    text: 'Tỷ lệ chuyển đổi ở bước thanh toán giảm 12% so với kỳ trước, nên kiểm tra lại quy trình checkout.',
  },
  {
    id: 5,
    type: 'anomaly',
    text: 'Phát hiện bất thường: đơn hàng tăng đột biến vào khung giờ 21h–23h hôm qua, cao hơn 3 lần mức trung bình.',
  },
]
