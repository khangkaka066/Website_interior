// So khớp tên địa danh tiếng Việt (bỏ dấu, bỏ tiền tố Quận/Huyện/Phường...), dùng để đổi tên khách đã chọn/gõ sang mã Goship.
export const normalizeVi = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()

const TYPE_PREFIX = /^(thanh pho|tp\.?|tinh|quan|huyen|thi xa|thi tran|phuong|xa) /

// Khớp đúng tên trước; không thì khớp phần tên bỏ tiền tố, chỉ nhận khi duy nhất (không đoán bừa).
export function findByName(list, name) {
  const key = normalizeVi(name)
  if (!key) return undefined
  const exact = list.find((i) => normalizeVi(i.name) === key)
  if (exact) return exact
  const short = key.replace(TYPE_PREFIX, '')
  const same = list.filter((i) => normalizeVi(i.name).replace(TYPE_PREFIX, '') === short)
  return same.length === 1 ? same[0] : undefined
}
