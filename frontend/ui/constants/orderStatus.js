export const ORDER_STATUS = {
  PENDING_CONFIRMATION: { label: 'Chờ xác nhận', cls: 'status-pending' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'status-processing' },
  PROCESSING: { label: 'Đang xử lý', cls: 'status-processing' },
  AWAITING_SHIPMENT: { label: 'Chờ giao hàng', cls: 'status-ready' },
  SHIPPING: { label: 'Đang giao', cls: 'status-shipping' },
  DELIVERED: { label: 'Đã giao', cls: 'status-delivered' },
  CANCELLED: { label: 'Đã hủy', cls: 'status-cancelled' },
  RETURNED: { label: 'Đã trả hàng', cls: 'status-returned' },
}

export const PAYMENT_STATUS = {
  AWAITING_PAYMENT: { label: 'Chờ thanh toán', cls: 'status-pending' },
  PAID: { label: 'Đã thanh toán', cls: 'status-delivered' },
  FAILED: { label: 'Thanh toán thất bại', cls: 'status-cancelled' },
  REFUNDED: { label: 'Đã hoàn tiền', cls: 'status-returned' },
}

// Timeline hiển thị trên Order Detail (thứ tự cố định, độc lập với việc đơn
// có bị hủy/trả hàng hay không — hai nhánh đó hiển thị riêng).
export const ORDER_TIMELINE_STEPS = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PROCESSING',
  'AWAITING_SHIPMENT',
  'SHIPPING',
  'DELIVERED',
]

export function orderStatusLabel(status) {
  return ORDER_STATUS[status]?.label || status
}

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS[status]?.label || status
}

// Bước kế tiếp hợp lệ theo workflow (khớp với backend constants/workflow.js) —
// dùng để chỉ hiển thị action admin được phép bấm.
export const ORDER_TRANSITIONS = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['AWAITING_SHIPMENT', 'CANCELLED'],
  AWAITING_SHIPMENT: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
}
