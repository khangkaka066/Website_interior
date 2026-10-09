export const SHIPPING_STATUS = {
  NOT_CREATED: { label: 'Chưa tạo vận đơn', cls: 'status-pending' },
  AWAITING_PICKUP: { label: 'Chờ lấy hàng', cls: 'status-pending' },
  PICKED_UP: { label: 'Đã lấy hàng', cls: 'status-processing' },
  IN_TRANSIT: { label: 'Đang trung chuyển', cls: 'status-processing' },
  OUT_FOR_DELIVERY: { label: 'Đang giao', cls: 'status-shipping' },
  DELIVERED: { label: 'Giao thành công', cls: 'status-delivered' },
  FAILED: { label: 'Giao thất bại', cls: 'status-cancelled' },
  RETURNING: { label: 'Đang hoàn', cls: 'status-returned' },
  RETURNED: { label: 'Đã hoàn', cls: 'status-returned' },
}

// Timeline hiển thị trên Shipping Detail.
export const SHIPPING_TIMELINE_STEPS = [
  'AWAITING_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export function shippingStatusLabel(status) {
  return SHIPPING_STATUS[status]?.label || status
}

// Bước kế tiếp hợp lệ theo workflow (khớp với backend constants/workflow.js) —
// dùng để chỉ hiển thị action admin được phép bấm.
export const SHIPPING_TRANSITIONS = {
  NOT_CREATED: ['AWAITING_PICKUP'],
  AWAITING_PICKUP: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  FAILED: ['OUT_FOR_DELIVERY', 'RETURNING'],
  RETURNING: ['RETURNED'],
  DELIVERED: [],
  RETURNED: [],
}
