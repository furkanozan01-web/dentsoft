'use client'

import { useEffect } from 'react'
import { formatMoneyInput } from '@/lib/format'

/**
 * Para alanlarını yazarken biçimlendirir: 100000 → 100.000, 1500,5 → 1.500,5
 * Biçimlendirilecek alanlara `data-money` özelliği konur (metin alanı). Tüm para ayrıştırıcıları binlik noktayı
 * (cleanMoney) kaldırdığı için kaydedilen değer değişmez.
 */
export default function MoneyInputFormatter() {
  useEffect(() => {
    const handler = (event: Event) => {
      const el = event.target as HTMLInputElement | null
      if (!el || el.tagName !== 'INPUT' || !el.hasAttribute('data-money')) return
      if ((event as InputEvent).isComposing) return
      const before = el.value
      const next = formatMoneyInput(before)
      if (next === before) return
      const caret = el.selectionStart ?? before.length
      const significantBefore = before.slice(0, caret).replace(/[^\d,]/g, '').length
      // React'in değer izleyicisini atlayan yerel setter: onChange yeni (biçimli) değerle tetiklenir
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, next)
      let pos = 0
      let count = 0
      while (pos < next.length && count < significantBefore) {
        if (/[\d,]/.test(next[pos])) count += 1
        pos += 1
      }
      try { el.setSelectionRange(pos, pos) } catch { /* bazı girdi türlerinde desteklenmez */ }
    }
    document.addEventListener('input', handler, true)
    return () => document.removeEventListener('input', handler, true)
  }, [])
  return null
}
