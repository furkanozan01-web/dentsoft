

// ─── Tab türleri ──────────────────────────────────────────────────────────────
export type ActivePlanTab = 'diyagnoz' | `planlama_${number}` | `faz_${number}` | 'tedavi'
export const BRANCH_ORDER = [
  'Cerrahi',
  'Endodonti',
  'Restoratif',
  'Periodontoloji',
  'Protez',
  'Ortodonti',
  'Pedodonti',
  'Muayene',
  'Diğer',
]
export function tariffBranch(category: string | null) {
  const value = (category ?? '').toLocaleLowerCase('tr-TR')
  if (value.includes('cerrahi')) return 'Cerrahi'
  if (value.includes('endodont')) return 'Endodonti'
  if (value.includes('konservatif') || value.includes('restoratif')) return 'Restoratif'
  if (value.includes('periodont')) return 'Periodontoloji'
  if (value.includes('protez')) return 'Protez'
  if (value.includes('ortodont')) return 'Ortodonti'
  if (value.includes('pedodont')) return 'Pedodonti'
  if (value.includes('muayene') || value.includes('teşhis')) return 'Muayene'
  return 'Diğer'
}
export function isUpperTooth(n: number) { return (n >= 11 && n <= 28) || (n >= 51 && n <= 65) }
export function parseTab(tab: ActivePlanTab): {
  kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi'
  num: number
} {
  if (tab === 'diyagnoz') return { kind: 'diyagnoz', num: 1 }
  if (tab === 'tedavi') return { kind: 'tedavi', num: 0 }
  const under = tab.lastIndexOf('_')
  const kind = tab.slice(0, under) as 'planlama' | 'faz'
  const num = Number(tab.slice(under + 1))
  return { kind, num }
}
// ─── Diyagnoz öğeleri ────────────────────────────────────────────────────────
export const DIAGNOSIS_ITEMS = [
  { key: 'extracted',   name: 'Çekilmiş Diş',      color: '#DC2626' },
  { key: 'mineCaryo',   name: 'Mine Çürüğü',        color: '#7C2D12' },
  { key: 'dentinCaryo', name: 'Dentin Çürüğü',      color: '#78350F' },
  { key: 'kret',        name: 'Kret',               color: '#2563EB' },
  { key: 'nerve',       name: 'Mandibular Sinir',   color: '#D97706' },
  { key: 'periapical',  name: 'Periapikal Lezyon',  color: '#7C3AED' },
  { key: 'poorCanal',   name: 'Yetersiz Kanal',     color: '#EA580C' },
] as const
// ─── Renk şeması ─────────────────────────────────────────────────────────────
export const PLANLAMA_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981']
export const FAZ_COLORS = ['#F59E0B', '#F97316', '#EF4444', '#84CC16', '#6366F1']
export function getMarkerColor(
  kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi',
  num: number
): string | undefined {
  if (kind === 'diyagnoz') return '#374151'
  if (kind === 'planlama') return PLANLAMA_COLORS[(num - 1) % PLANLAMA_COLORS.length]
  if (kind === 'faz') return FAZ_COLORS[(num - 1) % FAZ_COLORS.length]
  return undefined
}
