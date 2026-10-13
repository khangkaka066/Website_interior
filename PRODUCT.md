# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Khách mua lẻ và khách mua sỉ tại Việt Nam, mua qua web (giỏ hàng, thanh toán, tra cứu đơn).
- Chủ shop / nhân viên vận hành dùng dashboard quản trị (đơn hàng, sản phẩm, khách hàng, vận chuyển, khuyến mãi, tin tức, SEO, phân tích).

## Product Purpose
Clevinum (clevinium.com, theo danh thiếp CLEVI INTERIOR) là website bán hàng nội thất trực tiếp (vật liệu, bảng hiệu đèn, đồ gỗ, rèm), thay thế phụ thuộc vào sàn (có nhập/xuất dữ liệu Shopee). Thành công: khách tìm được sản phẩm, đặt hàng và theo dõi đơn dễ dàng; chủ shop quản lý đơn và kho gọn.

## Positioning
Chưa xác nhận. Điểm khác biệt so với sàn thương mại điện tử chưa được người dùng mô tả.

## Operating Context
- Giao hàng qua GHN, GHTK, Viettel Post, J&T, VNPost; kho Bình Thạnh.
- Giao diện tiếng Việt. Có đăng nhập Google, trang tin tức, FAQ, chính sách, điều khoản.

## Capabilities and Constraints
- Stack hiện có: Next.js (App Router) + Tailwind trong `frontend/`, backend Node + Prisma trong `backend/`.
- Nội dung site (about, store) tải từ backend qua `loadSite`.
- Nhóm sản phẩm và lĩnh vực hoạt động khai báo ở `frontend/ui/data/menu.js`. Danh mục `vat-lieu`, `bang-hieu-den`, `do-go` hiện chưa có sản phẩm/ảnh.
- Chưa xác định: chính sách giá sỉ. Tính năng xem thử rèm 3D đã gỡ, không dựng lại.
- CSS cũ trong `frontend/ui/styles/` (layer `legacy`), Tailwind không có preflight; trang Tailwind bọc trong `tw-reset`.

## Brand Commitments
Chỉ giữ tên "Clevinum" và nội dung hiện tại. Chưa có ràng buộc logo, màu, font hay giọng văn; được tự do đề xuất.

## Evidence on Hand
Chưa có testimonial, số liệu hay case study xác nhận. Không được bịa. Ảnh có sẵn: `docs/download.jpeg` và hai ảnh .jpg ở thư mục gốc (chưa rõ nguồn).

## Product Principles
- Tin cậy trước: giá, phí ship, trạng thái đơn phải rõ ràng.
- Mua lẻ và mua sỉ đều có đường đi riêng, không làm khó nhau.
- Tối ưu cho điện thoại và mạng Việt Nam.
- Dashboard ưu tiên tốc độ thao tác hơn trang trí.

## Accessibility & Inclusion
Chưa có yêu cầu riêng; mặc định tiếng Việt có dấu, chữ đủ lớn, tương phản đạt WCAG AA.
