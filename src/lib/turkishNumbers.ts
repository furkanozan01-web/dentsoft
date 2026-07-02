const ONES = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz']
const TENS = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan']
const GROUPS = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon']

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  let s = ''
  if (hundreds > 0) s += (hundreds === 1 ? '' : ONES[hundreds] + ' ') + 'Yüz '
  if (tens > 0) s += TENS[tens] + ' '
  if (ones > 0) s += ONES[ones] + ' '
  return s.trim()
}

// Tam sayıyı Türkçe yazıya çevirir (₺ tutarları için — kuruş her zaman 0
// varsayılır, senet tutarları tam bin TL'ye yuvarlandığı için kuruş yazılmaz).
export function numberToTurkishWords(value: number): string {
  const n = Math.round(Math.abs(value))
  if (n === 0) return 'Sıfır'

  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    // "Bin" grubunda 1 yüzlük kısmı sadece "Bin" olarak yazılır (Bir Bin değil).
    const groupWords = i === 1 && g === 1 ? 'Bin' : `${threeDigitsToWords(g)} ${GROUPS[i]}`.trim()
    parts.push(groupWords)
  }

  return parts.join(' ').trim()
}

// kuruş cinsinden bir tutarı "Beş Bin Türk Lirası" formatında yazıya çevirir.
export function amountToTurkishWords(kurus: number): string {
  const lira = Math.round(kurus / 100)
  return `${numberToTurkishWords(lira)} Türk Lirası`
}
