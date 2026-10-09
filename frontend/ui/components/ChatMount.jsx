'use client'

import ChatWidget from './ChatWidget'
import ClientOnly from './ClientOnly'

// Khung chat nổi: dùng localStorage và luồng thời gian thực nên chỉ chạy ở trình duyệt.
export default function ChatMount() {
  return (
    <ClientOnly>
      <ChatWidget />
    </ClientOnly>
  )
}
