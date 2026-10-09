// Giá gốc gạch ngang + % giảm, hiện cạnh giá đã giảm (sản phẩm có SKU trong Dashboard > Giảm giá). Không giảm giá thì không vẽ gì.
export default function PriceOld({ product }) {
  if (!product?.originalPrice) return null
  return (
    <>
      {' '}
      <s className="price-old">{product.originalPrice.toLocaleString('vi-VN')}đ</s>{' '}
      <span className="price-pct">-{product.discountPercent}%</span>
    </>
  )
}
