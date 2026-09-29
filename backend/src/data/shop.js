// Mirrors frontend/src/data/shop.js so the API serves the same real shop
// data (from https://shopee.vn/clevi.interior) the storefront was built
// from. Keep both in sync until the frontend is switched to fetch from here.
export const shopInfo = {
  name: 'CLEVINUM',
  tagline: 'Rèm Việt Giá Sỉ',
  subBrand: 'CURTAIN · PREMIUM QUALITY',
  hotline: '1900 246 304',
  stats: [
    { label: 'Đánh giá', value: '4.9★', sub: '44,1k đánh giá' },
    { label: 'Người theo dõi', value: '86,5k', sub: 'trên Shopee' },
    { label: 'Hoạt động', value: '9 năm', sub: 'kinh nghiệm' },
    { label: 'Phản hồi chat', value: '71%', sub: 'trong vài giờ' },
  ],
  address: 'Phường Hiệp Bình, TP. Hồ Chí Minh',
}

export const categories = [
  {
    id: 'dan-tuong',
    name: 'Rèm Dán Tường',
    bg: 'cream',
    image: '/images/curtains/collage-dan-tuong.png',
  },
  {
    id: 'chong-nang',
    name: 'Rèm Cửa Chống Nắng',
    bg: 'blush',
    image: '/images/curtains/black.png',
    featured: true,
  },
  { id: 'voan-lua', name: 'Rèm Voan Lụa', bg: 'white', image: '/images/curtains/room-sheer-white.png' },
  { id: 'thanh-treo', name: 'Thanh Treo Rèm', bg: 'dark', image: '/images/curtains/silver.png' },
]

export const products = [
  {
    id: 'p1',
    name: 'Rèm cửa sổ chống nắng cao cấp',
    price: 228438,
    discount: 37,
    rating: 4.9,
    sold: '60k+',
    image: '/images/curtains/blue.png',
    tab: 'new',
  },
  {
    id: 'p2',
    name: 'Rèm Cửa Sổ Dán Tường Chống Sáng 95%',
    price: 221760,
    discount: 34,
    rating: 4.9,
    sold: '5k+',
    image: '/images/curtains/black.png',
    tab: 'new',
  },
  {
    id: 'p3',
    name: 'Rèm đục lỗ ore vải gấm dày chống nắng cản',
    price: 153984,
    discount: 49,
    rating: 4.9,
    sold: '5k+',
    image: '/images/curtains/brown.png',
    tab: 'best',
  },
  {
    id: 'p4',
    name: '(1 mét) Miếng dán tường mặt bông không keo',
    price: 11955,
    discount: 37,
    rating: 4.9,
    sold: '10k+',
    image: '/images/curtains/silver.png',
    tab: 'latest',
  },
  {
    id: 'p5',
    name: 'Thanh treo rèm cao cấp giá xưởng',
    price: 106977,
    discount: 33,
    rating: 4.8,
    sold: '40k+',
    image: '/images/curtains/purple-gray.png',
    tab: 'best',
  },
  {
    id: 'p6',
    name: 'Rèm đục lỗ ore vải gấm dày chống nắng cản',
    price: 327618,
    discount: 47,
    rating: 4.8,
    sold: '7k+',
    image: '/images/curtains/gold.png',
    tab: 'latest',
  },
  {
    id: 'p7',
    name: 'Gối tựa sofa vải gấm mềm mại 450x450 nhiều màu sắc',
    price: 132045,
    discount: 40,
    rating: 4.9,
    sold: '340',
    image: '/images/curtains/pillow.png',
    tab: 'best',
  },
]
