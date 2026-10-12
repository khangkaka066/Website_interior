import LegalPage, { CONTACT_EMAIL } from '@/components/site/LegalPage'

export const metadata = {
  title: 'Chính sách bảo mật',
  description: 'Clevinum thu thập, sử dụng và bảo vệ thông tin cá nhân của khách hàng như thế nào.',
}

const sections = [
  {
    title: 'Thông tin chúng tôi thu thập',
    items: [
      'Thông tin đặt hàng: họ tên, số điện thoại, email (không bắt buộc), địa chỉ giao hàng.',
      'Thông tin tài khoản: họ tên, email và mật khẩu (được mã hóa một chiều, chúng tôi không đọc được mật khẩu của bạn). Nếu đăng nhập bằng Google, chúng tôi chỉ nhận họ tên và địa chỉ email đã xác minh từ Google.',
      'Dữ liệu sử dụng website: các trang đã xem, nguồn truy cập, nội dung trò chuyện với cửa hàng, nhằm vận hành và cải thiện dịch vụ.',
    ],
  },
  {
    title: 'Mục đích sử dụng',
    items: [
      'Xử lý, giao hàng và chăm sóc đơn hàng; gửi email xác nhận và cập nhật trạng thái đơn.',
      'Tạo và quản lý tài khoản, hiển thị lịch sử đơn hàng của bạn.',
      'Hỗ trợ khách hàng, giải quyết khiếu nại, bảo hành và đổi trả.',
      'Phát hiện gian lận, bảo vệ an toàn cho website và khách hàng.',
    ],
  },
  {
    title: 'Chia sẻ thông tin',
    paragraphs: [
      'Chúng tôi không bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ với bên thứ ba khi cần thiết để hoàn tất dịch vụ: đơn vị vận chuyển (để giao hàng), cổng thanh toán hoặc ngân hàng (để xác nhận thanh toán), nhà cung cấp email và hạ tầng lưu trữ, hoặc khi cơ quan nhà nước có thẩm quyền yêu cầu theo quy định pháp luật.',
    ],
  },
  {
    title: 'Đăng nhập bằng Google',
    paragraphs: [
      'Khi bạn chọn đăng nhập bằng Google, chúng tôi chỉ sử dụng họ tên và địa chỉ email để tạo hoặc đăng nhập tài khoản. Chúng tôi không truy cập danh bạ, Drive, lịch hay dữ liệu Google khác của bạn.',
    ],
  },
  {
    title: 'Lưu trữ và bảo mật',
    paragraphs: [
      'Dữ liệu được lưu trên hạ tầng có kiểm soát truy cập, kết nối được mã hóa (HTTPS). Chúng tôi lưu thông tin trong thời gian cần thiết cho mục đích nêu trên hoặc theo quy định pháp luật. Dù đã áp dụng các biện pháp bảo mật hợp lý, không hệ thống nào an toàn tuyệt đối; bạn nên giữ kín mật khẩu của mình.',
    ],
  },
  {
    title: 'Quyền của bạn',
    paragraphs: [
      'Bạn có quyền xem và cập nhật thông tin trong trang Tài khoản, đổi mật khẩu, và yêu cầu chúng tôi truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân (trừ dữ liệu chúng tôi phải giữ theo quy định pháp luật, ví dụ chứng từ giao dịch). Hãy gửi yêu cầu tới ' + CONTACT_EMAIL + '.',
    ],
  },
  {
    title: 'Cookie và lưu trữ trên trình duyệt',
    paragraphs: [
      'Website lưu giỏ hàng, phiên đăng nhập và một số thiết lập trên trình duyệt của bạn để hoạt động đúng. Bạn có thể xóa dữ liệu này bất cứ lúc nào trong cài đặt trình duyệt.',
    ],
  },
  {
    title: 'Thay đổi chính sách',
    paragraphs: ['Chúng tôi có thể cập nhật chính sách này; phiên bản mới có hiệu lực khi đăng tải trên trang này, kèm ngày cập nhật ở đầu trang.'],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Chính sách bảo mật"
      intro="Clevinum (website clevinium.com) tôn trọng quyền riêng tư của khách hàng. Trang này giải thích chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn như thế nào khi bạn mua hàng hoặc sử dụng tài khoản."
      sections={sections}
    />
  )
}
