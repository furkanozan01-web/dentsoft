export const SOCIAL_CATEGORIES = [
  ['before_after', 'Öncesi / sonrası'],
  ['implant', 'İmplant'],
  ['prosthesis', 'Protez'],
  ['zirconium', 'Zirkonyum'],
  ['whitening', 'Diş beyazlatma'],
  ['root_canal', 'Kanal tedavisi'],
  ['orthodontics', 'Ortodonti'],
  ['smile_design', 'Gülüş tasarımı'],
  ['surgery', 'Cerrahi'],
  ['clinic', 'Klinik içi'],
  ['team', 'Hekim / ekip'],
  ['testimonial', 'Hasta yorumu'],
  ['education', 'Eğitim içeriği'],
  ['informative', 'Bilgilendirici içerik'],
  ['campaign', 'Kampanya'],
  ['special_day', 'Özel gün'],
  ['qa', 'Soru-cevap'],
  ['reels', 'Reels fikri'],
  ['story', 'Story fikri'],
  ['carousel', 'Karusel içerik'],
] as const

export const SOCIAL_PLATFORMS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube Shorts',
  'LinkedIn',
  'Google Business',
] as const

export const PACKAGE_STATUSES = [
  ['draft', 'Taslak'],
  ['awaiting_approval', 'Onay bekliyor'],
  ['ready', 'Hazır'],
  ['published', 'Yayınlandı'],
  ['archived', 'Arşivlendi'],
] as const

export function categoryLabel(value: string) {
  return SOCIAL_CATEGORIES.find(([key]) => key === value)?.[1] ?? value
}

export function statusLabel(value: string) {
  return PACKAGE_STATUSES.find(([key]) => key === value)?.[1] ?? value
}

