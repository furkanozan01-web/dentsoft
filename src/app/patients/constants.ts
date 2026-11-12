import type { TabId } from './types'

export const PATIENT_TABS: { id: TabId; label: string }[] = [
  { id: 'liste', label: 'Liste' },
  { id: 'hasta-karti', label: 'Hasta Kartı' },
  { id: 'oral', label: 'Oral' },
  { id: 'takip', label: 'Takip' },
  { id: 'not-goruntu', label: 'Not & Görüntü' },
  { id: 'hesap', label: 'Hesap' },
  { id: 'evrak', label: 'Evrak' },
  { id: 'fatura', label: 'Fatura' },
  { id: 'recete', label: 'Reçete' },
]

export const FDI = {
  upperPermanent: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lowerPermanent: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  upperPrimary: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  lowerPrimary: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
}
