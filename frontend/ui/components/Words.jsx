// Tiêu đề hiện từng từ: mỗi từ là một span có chỉ số --i; CSS (storefront.css) cho từng từ trượt lên + hiện dần, lệch nhau một nhịp.
// Mặc định chạy theo vị trí cuộn (từ hiện dần khi tiêu đề vào màn hình, cuộn ngược thì mờ lại); `load` chạy theo thời gian ngay khi mở trang (dùng cho hero).
// Chữ hiển thị đầy đủ từ HTML đầu tiên; trình duyệt không hỗ trợ hoặc khách bật "giảm chuyển động" thì không có hiệu ứng.
export default function Words({ text, start = 0, load = false }) {
  const words = text.split(' ')
  return (
    <span className={`words${load ? ' words-load' : ''}`}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="w" style={{ '--i': start + i }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}
