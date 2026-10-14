// Tên phương thức thanh toán hiển thị cho nhân viên / trên phiếu in. Mã PAYOS là chuyển khoản tự động qua PayOS; khách chỉ thấy "Chuyển khoản".
export const paymentMethodLabel = (m, { staff = true } = {}) => (m === 'PAYOS' ? (staff ? 'Chuyển khoản (PayOS)' : 'Chuyển khoản') : m)
