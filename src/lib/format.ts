// Ortak biçimlendirme yardımcıları.
// Para birimi alanları DB'de kuruş (integer) tutulur: 1 TL = 100 kuruş.

export const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

// Türkçe-duyarlı başlık biçimi. Sadece GÖSTERİMDE kullanılır, DB'ye yazılmaz.
export function toTitleCase(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .split(' ')
    .map((w) =>
      w
        ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')
        : w
    )
    .join(' ')
}

// kuruş → "1.000,00" (sembolsüz)
export function formatAmount(kurus: number | null | undefined): string {
  return ((kurus ?? 0) / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// kuruş → "₺1.000,00" (sembol bitişik, boşluksuz).
// Not: Intl currency biçimi sembol ile sayı arasına dar boşluk (U+00A0/U+202F)
// koyuyor; o yüzden manuel birleştiriyoruz.
export function formatCurrency(kurus: number | null | undefined): string {
  return '₺' + formatAmount(kurus)
}

// kuruş → "1.000" (ondalıksız, yuvarlanmış — KPI kartları gibi özet alanlarda kullanılır)
export function formatAmountRounded(kurus: number | null | undefined): string {
  return Math.round((kurus ?? 0) / 100).toLocaleString('tr-TR')
}

// "1.500,50" / "1500,50" / "1500.50" gibi kullanıcı girdisini kuruşa çevirir.
export function parseToKurus(input: string): number {
  const raw = (input ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
  const tl = parseFloat(raw)
  return isNaN(tl) ? 0 : Math.round(tl * 100)
}

export function localDateValue(date = new Date(), timeZone = 'Europe/Istanbul'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}
