import { prisma } from '../src/lib/prisma.js'
import { generateOrderNumber, generateTrackingId } from '../src/utils/ids.js'

const carriers = [
  { code: 'GHN', name: 'Giao Hàng Nhanh', serviceTypes: ['Giao nhanh', 'Giao tiết kiệm'] },
  { code: 'GHTK', name: 'Giao Hàng Tiết Kiệm', serviceTypes: ['Giao thường', 'Giao nhanh'] },
  { code: 'VTP', name: 'Viettel Post', serviceTypes: ['Chuyển phát nhanh', 'Chuyển phát tiêu chuẩn'] },
  { code: 'JT', name: 'J&T Express', serviceTypes: ['Giao tiêu chuẩn'] },
  { code: 'VNPOST', name: 'VNPost', serviceTypes: ['Giao thường', 'Giao nhanh'] },
]

const demoCustomers = [
  { name: 'Nguyễn Văn A', phone: '0901234567', email: 'vana@example.com' },
  { name: 'Trần Thị B', phone: '0912345678', email: 'thib@example.com' },
  { name: 'Lê Văn C', phone: '0923456789', email: 'vanc@example.com' },
  { name: 'Phạm Thị D', phone: '0934567890', email: 'thid@example.com' },
]

const TIMELINE_ORDER = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT', 'SHIPPING', 'DELIVERED']

// Build the full statusEvents history leading up to `status`, so seeded
// orders show a correct step timeline instead of just their final status.
function statusEventsFor(status) {
  const idx = TIMELINE_ORDER.indexOf(status)
  if (idx >= 0) {
    return TIMELINE_ORDER.slice(0, idx + 1).map((s) => ({ status: s }))
  }
  if (status === 'CANCELLED') {
    return [{ status: 'PENDING_CONFIRMATION' }, { status: 'CANCELLED', note: 'Khách hàng yêu cầu hủy' }]
  }
  if (status === 'RETURNED') {
    return [...TIMELINE_ORDER.map((s) => ({ status: s })), { status: 'RETURNED', note: 'Khách hàng trả hàng' }]
  }
  return [{ status }]
}

const sampleItem = (n) => ({
  name: `Sản phẩm mẫu ${n}`,
  sku: `SKU-${String(n).padStart(4, '0')}`,
  variant: 'Mặc định',
  quantity: n % 3 === 0 ? 2 : 1,
  unitPrice: 250000 + n * 15000,
  discount: 0,
})

async function main() {
  const carrierRecords = []
  for (const c of carriers) {
    const rec = await prisma.shippingCarrier.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, enabled: true, apiStatus: 'disconnected', serviceTypes: c.serviceTypes },
    })
    carrierRecords.push(rec)
  }
  console.log(`Seeded ${carrierRecords.length} shipping carriers.`)

  const existingOrders = await prisma.order.count()
  if (existingOrders > 0) {
    console.log('Orders already exist, skipping demo order seed.')
    return
  }

  const customerRecords = []
  for (const c of demoCustomers) {
    const rec = await prisma.customer.upsert({ where: { phone: c.phone }, update: {}, create: c })
    customerRecords.push(rec)
  }

  // [status, paymentStatus, hasShipment, shipmentStatus]
  const plan = [
    ['PENDING_CONFIRMATION', 'AWAITING_PAYMENT', false, null],
    ['CONFIRMED', 'PAID', false, null],
    ['PROCESSING', 'PAID', false, null],
    ['AWAITING_SHIPMENT', 'PAID', false, null],
    ['AWAITING_SHIPMENT', 'PAID', true, 'AWAITING_PICKUP'],
    ['SHIPPING', 'PAID', true, 'IN_TRANSIT'],
    ['SHIPPING', 'PAID', true, 'OUT_FOR_DELIVERY'],
    ['DELIVERED', 'PAID', true, 'DELIVERED'],
    ['CANCELLED', 'AWAITING_PAYMENT', false, null],
    ['SHIPPING', 'PAID', true, 'FAILED'],
    ['RETURNED', 'REFUNDED', true, 'RETURNED'],
    ['SHIPPING', 'PAID', true, 'RETURNING'],
  ]

  let n = 1
  for (const [status, paymentStatus, hasShipment, shipmentStatus] of plan) {
    const customer = customerRecords[n % customerRecords.length]
    const items = [sampleItem(n), ...(n % 2 === 0 ? [sampleItem(n + 1)] : [])]
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0)
    const shippingFee = 25000
    const total = subtotal + shippingFee

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        status,
        paymentStatus,
        paymentMethod: n % 2 === 0 ? 'COD' : 'Chuyển khoản',
        transactionId: paymentStatus === 'PAID' ? `TXN-${1000 + n}` : null,
        subtotal,
        discount: 0,
        shippingFee,
        tax: 0,
        total,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        addressLine: `${100 + n} Đường Lê Lợi`,
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        province: 'TP. Hồ Chí Minh',
        items: { create: items.map((it) => ({ ...it, lineTotal: it.unitPrice * it.quantity - it.discount })) },
        statusEvents: { create: statusEventsFor(status) },
      },
    })

    if (hasShipment) {
      const carrier = carrierRecords[n % carrierRecords.length]
      await prisma.shipment.create({
        data: {
          trackingId: generateTrackingId(carrier.code),
          orderId: order.id,
          carrierId: carrier.id,
          status: shipmentStatus,
          senderName: 'Kho Clevinum Bình Thạnh',
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          addressLine: order.addressLine,
          ward: order.ward,
          district: order.district,
          province: order.province,
          weightGrams: 500 + n * 50,
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10,
          goodsType: 'Hàng tiêu dùng',
          shippingFee,
          codAmount: order.paymentMethod === 'COD' ? total : 0,
          trackingEvents: {
            create: [
              { status: 'Đã tạo vận đơn', location: 'Kho Bình Thạnh' },
              ...(shipmentStatus !== 'AWAITING_PICKUP'
                ? [{ status: 'Đã lấy hàng', location: 'Kho Bình Thạnh' }]
                : []),
            ],
          },
        },
      })
    }

    n += 1
  }

  console.log(`Seeded ${plan.length} demo orders.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
