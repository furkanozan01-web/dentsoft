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

// kuruş → "1.000" (ondalıksız, yuvarlanmış — KPI kartları gibi özet alanlarda kullanılır)
export function formatAmountRounded(kurus: number | null | undefined): string {
  return Math.round((kurus ?? 0) / 100).toLocaleString('tr-TR')
}

/** Para girdisini ondalıklı sayı metnine çevirir; eksi işareti içeren (negatif) girdi geçersiz sayılır ('' döner) — sessizce pozitife çevrilmesin. */
export function cleanMoney(value: string | null | undefined): string {
  const v = value ?? ''
  if (/-/.test(v)) return ''
  return v.replace(/./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
}

// "1.500,50" / "1500,50" / "1500.50" gibi kullanıcı girdisini kuruşa çevirir.
export function parseToKurus(input: string): number {
  const raw = cleanMoney(input ?? '')
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

/** kuruş → düzenleme alanı metni: "4610,50" (binlik ayracı yok; cleanMoney ile geri okunabilir) */
export function kurusToInput(kurus: number): string {
  return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: false })
}
