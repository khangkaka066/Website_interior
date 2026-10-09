// Kiến thức SEO chia theo TỪNG BƯỚC của quy trình (xem seoPipeline.js). Mô hình miễn phí trên OpenRouter khá yếu và có ngữ cảnh ngắn nên mỗi bước
// chỉ nhận đúng các quy tắc của bước đó, ngắn và cụ thể, đã chuyển sang bối cảnh thương mại điện tử tại Việt Nam.
// Nguồn ý tưởng: bộ kỹ năng marketing mã nguồn mở https://github.com/coreyhaines31/marketingskills (giấy phép MIT) —
// các kỹ năng content-strategy, programmatic-seo, seo-audit, ai-seo, copywriting. Copyright (c) Corey Haines.

export const RULES = {
  // content-strategy: phân loại ý định + chọn từ khóa theo giai đoạn mua hàng
  intent: `- Ý định tìm kiếm: "mua hàng" (giá, mua, ở đâu, báo giá, giá rẻ, đặt may) | "so sánh" (loại nào tốt, nên chọn, so sánh, X hay Y) | "tìm hiểu" (là gì, cách, hướng dẫn, cách đo, cách lắp, cách giặt).
- Chọn 6-8 từ khóa chính: ít nhất 3 từ khóa "mua hàng" (cho trang sản phẩm/danh mục), 1-2 "so sánh", 1-2 "tìm hiểu" (cho bài viết).
- Mỗi từ khóa 2-6 từ, có dấu, đúng cách người Việt gõ tìm kiếm; không trùng nhau, không chung chung quá ("rèm").
- Mỗi từ khóa phải bám sát dữ liệu (sản phẩm/chủ đề), không lạc sang mặt hàng khác.`,

  // content-strategy (cụm chủ đề) + programmatic-seo (mẫu từ khóa)
  longtail: `- Từ khóa dài = [sản phẩm] + phòng (phòng ngủ, phòng khách, bếp, ban công) / chất liệu, màu / kích thước / nhu cầu (chống nắng, cách nhiệt, không cần khoan, nhà thuê) / giá xưởng / địa phương nếu có giao hoặc lắp tại chỗ.
- Cụm chủ đề: chọn 2-3 chủ đề trụ cột (pillar); mỗi trụ cột có 4-6 từ khóa vệ tinh (đối tượng, phòng, màu, chất liệu, vấn đề cần giải quyết).
- Từ khóa dài phải cụ thể và khác nhau (không chỉ đổi một chữ), dễ lên top hơn từ khóa chính.`,

  // programmatic-seo: trang hàng loạt có giá trị riêng
  pages: `- Mẫu trang đích: "[sản phẩm] cho [phòng/đối tượng]", "[sản phẩm] [màu/chất liệu]", "[X] hay [Y] loại nào tốt", "cách đo/lắp [sản phẩm]".
- Mỗi trang chỉ nhắm MỘT từ khóa chính và không trùng từ khóa của trang khác (tránh tự cạnh tranh nhau).
- Chỉ đề xuất trang khi có thể viết nội dung RIÊNG cho trang đó (nhu cầu, mẹo chọn, ảnh thực tế), không chỉ đổi tên biến. Ít trang mạnh tốt hơn nhiều trang mỏng; tránh nhồi từ khóa.
- "why" nêu rõ nội dung riêng của trang. "slug" là đường dẫn không dấu, ngắn, nối bằng gạch ngang.`,

  // seo-audit (độ dài, vị trí từ khóa) + copywriting (rõ ràng, lợi ích, CTA)
  meta: `- Tiêu đề trang 50-60 ký tự (TUYỆT ĐỐI không quá 60), từ khóa chính đứng gần đầu, có lý do để bấm (giá xưởng, giao toàn quốc, nhiều mẫu), khớp với nội dung trang.
- Mô tả 140-160 ký tự (không quá 160), chứa từ khóa chính, nêu lợi ích cụ thể và kết thúc bằng lời kêu gọi hành động rõ ("Xem giá và đặt ngay", "Nhận báo giá", "Xem mẫu"). Không dùng "Tìm hiểu thêm", "Nhấn vào đây".
- Viết cho người đọc: rõ ràng hơn hoa mỹ, lợi ích hơn tính năng, cụ thể hơn chung chung, dùng từ khách hàng hay dùng. Không bịa số liệu, giải thưởng, đánh giá. Tránh văn mẫu kiểu AI ("không chỉ... mà còn", liệt kê phủ định).`,

  // ai-seo: câu hỏi như người dùng gõ vào công cụ tìm kiếm / trợ lý AI
  questions: `- Viết câu hỏi đúng như người ta gõ vào Google hoặc hỏi trợ lý AI: "Rèm dán tường có bền không?", "Nên chọn rèm ore hay rèm voan cho phòng ngủ?", "Rèm dán tường dùng được bao lâu?".
- Phủ đủ 4 nhóm: đang gặp vấn đề ("làm sao để..."), tìm giải pháp ("... là gì", "loại nào ... "), so sánh ("X hay Y"), quyết định mua ("giá bao nhiêu", "mua ở đâu", "giao hàng/đổi trả thế nào").
- Mỗi câu một ý, kết thúc bằng dấu hỏi, đủ cụ thể để trả lời bằng đáp án trực tiếp 40-60 từ.`,

  // content-strategy: cơ cấu nội dung 60/30/10, mỗi bài một từ khóa
  blog: `- Cơ cấu lịch nội dung: 60% bài "tìm kiếm" (hướng dẫn, so sánh, trả lời câu hỏi), 30% bài "chia sẻ" (mẹo, ý tưởng phối đồ nội thất, câu chuyện khách hàng), 10% bài "thử nghiệm".
- Mỗi bài nhắm MỘT từ khóa chính khác nhau, khớp ý định tìm kiếm; tiêu đề chứa từ khóa chính, nêu rõ lợi ích cho người đọc.
- Chỉ đề xuất bài có thể nói thêm điều gì đó hữu ích hơn các bài đang có, không viết lại cho có.`,
}

// Giữ lại để tham khảo/kiểm thử: toàn bộ quy tắc gộp một chỗ.
export const SEO_KNOWLEDGE = Object.values(RULES).join('\n')
