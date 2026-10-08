// Kiểm tra req.body theo schema zod. Hợp lệ thì thay req.body bằng dữ liệu đã làm sạch
// (bỏ field lạ như unitPrice do client tự gửi), sai thì trả 400 với thông báo tiếng Việt.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Dữ liệu gửi lên không hợp lệ.'
      return res.status(400).json({ error: message })
    }
    req.body = result.data
    next()
  }
}
