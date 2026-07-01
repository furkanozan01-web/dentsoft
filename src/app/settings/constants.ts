import type { SettingsTab } from './types'

export const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'klinik', label: 'Klinik' },
  { id: 'dis-hekimi', label: 'Diş Hekimi' },
  { id: 'kullanici', label: 'Kullanıcı' },
  { id: 'tarife', label: 'Tarife' },
  { id: 'randevu', label: 'Randevu' },
]

export const SPECIALTIES = [
  'Pratisyen', 'Endodontist', 'Ortodontist', 'Periodontist',
  'Oral Cerrahi', 'Pedodontist', 'Protetik', 'Diğer',
]

export const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Pazartesi' },
  { key: 'tue', label: 'Salı' },
  { key: 'wed', label: 'Çarşamba' },
  { key: 'thu', label: 'Perşembe' },
  { key: 'fri', label: 'Cuma' },
  { key: 'sat', label: 'Cumartesi' },
  { key: 'sun', label: 'Pazar' },
]

export const PAYMENT_MODELS: { key: string; label: string; desc: string }[] = [
  { key: 'salary', label: 'Sabit Maaş', desc: 'Aylık sabit tutar' },
  { key: 'commission', label: 'Komisyon', desc: 'Ciro üzerinden yüzde' },
  { key: 'hybrid', label: 'Karma', desc: 'Maaş + komisyon' },
  { key: 'guarantee', label: 'Garantör Sistem', desc: 'Aylık garanti tutarı' },
  { key: 'bonus', label: 'Prim Bazlı', desc: 'Aylık performans primi' },
  { key: 'per_transaction', label: 'İşlem Bazlı', desc: 'Tamamlanan işlem başına tutar' },
  { key: 'revenue', label: 'Ciro Bazlı', desc: 'Brüt ciro üzerinden yüzde' },
]

export const PAYMENT_MODEL_LABEL: Record<string, string> = {
  salary: 'Sabit Maaş', commission: 'Komisyon', hybrid: 'Sabit + Komisyon',
  guarantee: 'Garantör Sistem', bonus: 'Prim Bazlı', per_transaction: 'İşlem Bazlı', revenue: 'Ciro Bazlı',
}

export const ROLE_LABEL: Record<string, string> = {
  bashekim: 'Başhekim',
  responsible_manager: 'Mesul Müdür',
  hekim: 'Hekim',
  asistan: 'Asistan',
}

export const ASSIGNABLE_ROLES = [
  { key: 'asistan', label: 'Asistan' },
  { key: 'hekim', label: 'Hekim' },
  { key: 'responsible_manager', label: 'Mesul Müdür' },
]
