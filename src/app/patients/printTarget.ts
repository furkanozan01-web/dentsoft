// Aynı sayfada birden fazla gizli yazdırma bloğu (tedavi dökümü, senet,
// ödeme geçmişi) bulunabiliyor. Hangisinin yazdırılacağını <html> üzerindeki
// data-print-target özelliğiyle işaretleyip, her bloğun @media print CSS'i
// bu özelliğe göre kendini gösterir/gizler — böylece butonlar birbirine
// karışmaz.
export function triggerPrint(elementId: string, target: string): boolean {
  const el = document.getElementById(elementId)
  if (!el) return false
  document.documentElement.setAttribute('data-print-target', target)
  const clear = () => document.documentElement.removeAttribute('data-print-target')
  window.addEventListener('afterprint', clear, { once: true })
  window.print()
  return true
}
