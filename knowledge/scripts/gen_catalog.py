import json, re, collections, datetime, sys
src, outdir = sys.argv[1], sys.argv[2]
L = json.load(open(src))
CATS = {'dan-tuong':'Rèm Dán Tường & RIDO móc','chong-nang':'Rèm Ore','voan-lua':'Rèm Voan Lụa','thanh-treo':'Thanh Treo Rèm',
        'rem-khac':'Rèm Khác','vat-lieu':'Sơn tường & vật liệu ốp','bang-hieu-den':'Bảng hiệu, decal & đèn LED','do-go':'Đồ gỗ nội thất'}
def load(v):
    if isinstance(v, str):
        try: return json.loads(v.replace("'", '"'))
        except Exception: return []
    return v or []
def vnd(n): return f"{int(n):,}".replace(',', '.')
rows, data = collections.defaultdict(list), []
for p in L:
    var = load(p.get('variants')); opts = load(p.get('options'))
    prices = [v['price'] for v in var if v.get('price')] or ([float(p['price'])] if p.get('price') else [])
    lo, hi = (min(prices), max(prices)) if prices else (None, None)
    o = {x['name']: x.get('values', []) for x in opts}
    data.append({'id': p['id'], 'url': f"/products/{p['id']}", 'name': p['name'], 'category': p['categoryId'],
                 'price_min_vnd': lo, 'price_max_vnd': hi, 'options': o, 'variant_count': len(var), 'source': 'shopee' if p['id'].startswith('sp') else 'contact-only'})
    rows[p['categoryId']].append((p, lo, hi, o, len(var)))
json.dump(data, open(f"{outdir}/data/products.json", 'w'), ensure_ascii=False, indent=1)
out = ["---", "name: web-catalog", "description: Danh mục 65 sản phẩm đang hiển thị trên clevinium.com (id, URL, giá thấp-cao, tùy chọn màu/kích thước). Sinh tự động từ API công khai.",
       "source: GET https://clevinium.com/api/shop/products", f"verified: {datetime.date.today().isoformat()}", "---", "",
       "# Danh mục sản phẩm trên website", "",
       "- Giá là **VND**, là khoảng thấp–cao giữa các biến thể (màu × kích thước). Giá thực tế phụ thuộc kích thước người mua chọn.",
       "- Trường `sold` của API đều bằng 0 và `stock` không đáng tin: **không dùng làm số liệu bán hàng** (xem `risks-and-open-questions.md`).",
       "- Sản phẩm `sp…` đồng bộ từ Shopee `clevi.interior`. Sản phẩm `lh-…` là mục \"liên hệ\", chưa có giá.",
       "- Dữ liệu máy đọc: `../data/products.json`. Làm mới: `curl -s https://clevinium.com/api/shop/products -o /tmp/products.json && python3 -I knowledge/scripts/gen_catalog.py /tmp/products.json knowledge`.", ""]
for cid in ['dan-tuong','chong-nang','voan-lua','thanh-treo','rem-khac','vat-lieu','bang-hieu-den','do-go']:
    items = rows.get(cid, [])
    if not items: continue
    out += [f"## {CATS[cid]} (`{cid}`, {len(items)} sản phẩm)", "", "| Sản phẩm | Giá (VND) | Màu / kích thước |", "|---|---|---|"]
    for p, lo, hi, o, nv in items:
        price = '—' if lo is None else (vnd(lo) if lo == hi else f"{vnd(lo)} – {vnd(hi)}")
        color = next((v for k, v in o.items() if 'Màu' in k), []); size = next((v for k, v in o.items() if 'Kích' in k), [])
        det = []
        if color: det.append(f"{len(color)} màu" + (f": {', '.join(color[:8])}" if len(color) <= 8 else ""))
        if size: det.append(f"{len(size)} cỡ" + (f": {size[0]} … {size[-1]}" if len(size) > 2 else ""))
        name = re.sub(r'\s+', ' ', p['name']).replace('|', '/')
        out.append(f"| [{name}](/san-pham/{p['id']}) `{p['id']}` | {price} | {'; '.join(det) or '—'} |")
    out.append("")
open(f"{outdir}/products/web-catalog.md", 'w').write('\n'.join(out))
print(len(data), 'products;', {c: len(v) for c, v in rows.items()})
