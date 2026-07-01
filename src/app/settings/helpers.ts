import { DAYS } from './constants'
import type { DayHours } from './types'

export function emptyWorkHours(): Record<string, DayHours> {
  const o: Record<string, DayHours> = {}
  for (const d of DAYS) {
    o[d.key] = { start: '09:00', end: '18:00', clinic: '', off: d.key === 'sat' || d.key === 'sun' }
  }
  return o
}

export function fmtPrice(price: number, currency: string) {
  const val = price / 100
  if (currency === 'EUR') return `EUR ${val.toFixed(2)}`
  if (currency === 'USD') return `$${val.toFixed(2)}`
  return `TL ${val.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}