'use client'

import Script from 'next/script'

// Nạp Meta Pixel / TikTok Pixel / Google tag khi đã khai báo ID trong biến môi trường (NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_TIKTOK_PIXEL_ID,
// NEXT_PUBLIC_GOOGLE_TAG_ID). Không có ID thì không tải gì cả. Sự kiện gửi qua ui/pixels.js (PageView do app/providers.jsx gọi mỗi lần đổi trang,
// nên mã nạp bên dưới KHÔNG tự gửi PageView để không bị đếm đôi).
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
const GOOGLE = (process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || '').split(',').map((s) => s.trim()).filter(Boolean)

// ID chỉ gồm chữ, số, gạch ngang/dưới: chặn ký tự lạ lọt vào đoạn mã inline.
const safe = (v) => (v && /^[A-Za-z0-9_-]+$/.test(v) ? v : null)

export default function AdPixels() {
  const meta = safe(META)
  const tiktok = safe(TIKTOK)
  const google = GOOGLE.filter(safe)
  return (
    <>
      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${meta}');
`}</Script>
      )}
      {tiktok && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${tiktok}');
}(window,document,'ttq');
`}</Script>
      )}
      {google.length > 0 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${google[0]}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
gtag('js',new Date());
${google.map((id) => `gtag('config','${id}',{send_page_view:false});`).join('\n')}
`}</Script>
        </>
      )}
    </>
  )
}
