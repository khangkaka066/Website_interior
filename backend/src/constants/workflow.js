// Central definition of allowed status transitions so the API refuses any
// change that would violate the business workflow (per product spec: "Không
// cho admin thay đổi trạng thái tùy ý nếu trạng thái đó vi phạm workflow.")

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

// When a shipment reaches one of these statuses, the parent order's status
// is kept in sync automatically (Order và Shipping vẫn là 2 entity riêng,
// nhưng một số mốc shipping cần phản ánh lại lên order).
export const SHIPPING_TO_ORDER_STATUS = {
  PICKED_UP: 'SHIPPING',
  IN_TRANSIT: 'SHIPPING',
  OUT_FOR_DELIVERY: 'SHIPPING',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
}

export function canTransitionOrder(from, to) {
  return (ORDER_TRANSITIONS[from] || []).includes(to)
}

export function canTransitionShipping(from, to) {
  return (SHIPPING_TRANSITIONS[from] || []).includes(to)
}
