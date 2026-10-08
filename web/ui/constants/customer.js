export const CUSTOMER_STATUS = {
  ACTIVE: { label: 'Đang hoạt động', cls: 'status-delivered' },
  INACTIVE: { label: 'Không hoạt động', cls: 'status-pending' },
  BLOCKED: { label: 'Đã khóa', cls: 'status-cancelled' },
}

export const CUSTOMER_SEGMENT = {
  NEW: { label: 'Khách mới', cls: 'status-ready' },
  RETURNING: { label: 'Khách quay lại', cls: 'status-processing' },
  VIP: { label: 'VIP', cls: 'status-delivered' },
  HIGH_VALUE: { label: 'Chi tiêu cao', cls: 'status-shipping' },
  AT_RISK: { label: 'Có nguy cơ rời bỏ', cls: 'status-returned' },
  INACTIVE: { label: 'Không hoạt động', cls: 'status-cancelled' },
}

export function customerStatusLabel(status) {
  return CUSTOMER_STATUS[status]?.label || status
}

export function customerSegmentLabel(segment) {
  return CUSTOMER_SEGMENT[segment]?.label || segment
}
