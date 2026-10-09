export const AD_PLATFORM = {
  META: { label: 'Meta (Facebook/Instagram)', cls: 'status-processing' },
  GOOGLE: { label: 'Google Ads', cls: 'status-delivered' },
  TIKTOK: { label: 'TikTok Ads', cls: 'status-cancelled' },
}

export const CAMPAIGN_STATUS = {
  DRAFT: { label: 'Bản nháp', cls: 'status-pending' },
  ACTIVE: { label: 'Đang chạy', cls: 'status-delivered' },
  PAUSED: { label: 'Tạm dừng', cls: 'status-returned' },
  COMPLETED: { label: 'Đã kết thúc', cls: 'status-cancelled' },
}

export const CREATIVE_TYPE = {
  IMAGE: 'Hình ảnh',
  VIDEO: 'Video',
  CAROUSEL: 'Carousel',
}

export function platformLabel(p) {
  return AD_PLATFORM[p]?.label || p
}

export function campaignStatusLabel(s) {
  return CAMPAIGN_STATUS[s]?.label || s
}
