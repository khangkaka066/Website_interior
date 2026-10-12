import LegalPage from '@/components/site/LegalPage'

export const metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản khi mua hàng và sử dụng website Clevinum.',
}

const sections = [
  {
    title: 'Chấp nhận điều khoản',
    paragraphs: ['Khi truy cập website, tạo tài khoản hoặc đặt hàng, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng website.'],
  },
  {
    title: 'Đặt hàng và tài khoản',
    items: [
      'Bạn có thể mua hàng không cần tài khoản. Tạo tài khoản giúp xem lại lịch sử đơn hàng và lưu địa chỉ.',
      'Bạn cung cấp thông tin chính xác (họ tên, số điện thoại, địa chỉ) và chịu trách nhiệm về thông tin đó.',
      'Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động trong tài khoản của mình.',
      'Đơn hàng được xác nhận sau khi cửa hàng kiểm tra tồn kho và thông tin; cửa hàng có thể từ chối hoặc hủy đơn trong trường hợp hết hàng, sai giá do lỗi hiển thị hoặc nghi ngờ gian lận, và sẽ hoàn lại khoản đã thanh toán (nếu có).',
    ],
  },
  {
    title: 'Giá và thanh toán',
    paragraphs: [
      'Giá niêm yết bằng đồng Việt Nam; phí vận chuyển (nếu có) được hiển thị trước khi bạn đặt hàng. Các phương thức thanh toán khả dụng được liệt kê ở bước thanh toán. Đơn thanh toán online chưa hoàn tất có thể được thanh toán lại ở trang Tra cứu đơn hàng.',
    ],
  },
  {
    title: 'Giao hàng, đổi trả',
    paragraphs: [
      'Thời gian giao hàng là dự kiến và có thể thay đổi theo đơn vị vận chuyển. Chính sách đổi trả, bảo hành được trình bày ở trang Câu hỏi thường gặp; vui lòng kiểm tra hàng khi nhận và liên hệ cửa hàng sớm nếu có sai sót.',
    ],
  },
  {
    title: 'Sử dụng website',
    items: [
      'Không sử dụng website vào mục đích trái pháp luật, gây hại hoặc làm gián đoạn hoạt động của hệ thống.',
      'Không thu thập dữ liệu hàng loạt, dò quét hay truy cập trái phép vào tài khoản của người khác.',
    ],
  },
  {
    title: 'Sở hữu trí tuệ',
    paragraphs: ['Hình ảnh, nội dung và thương hiệu trên website thuộc quyền của Clevinum hoặc bên cấp phép, không được sao chép hay sử dụng thương mại khi chưa có sự đồng ý bằng văn bản.'],
  },
  {
    title: 'Giới hạn trách nhiệm',
    paragraphs: ['Chúng tôi nỗ lực giữ thông tin sản phẩm chính xác và website hoạt động ổn định, nhưng không đảm bảo website không bao giờ gián đoạn hay không có sai sót. Trong phạm vi pháp luật cho phép, trách nhiệm của chúng tôi giới hạn ở giá trị đơn hàng liên quan.'],
  },
  {
    title: 'Quyền riêng tư và thay đổi điều khoản',
    paragraphs: ['Việc xử lý thông tin cá nhân được nêu tại Chính sách bảo mật. Chúng tôi có thể cập nhật điều khoản này; phiên bản mới có hiệu lực khi đăng tải trên trang này.'],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Điều khoản sử dụng"
      intro="Điều khoản này áp dụng khi bạn mua hàng hoặc sử dụng website clevinium.com của Clevinum. Vui lòng đọc kỹ trước khi sử dụng."
      sections={sections}
    />
  )
}
