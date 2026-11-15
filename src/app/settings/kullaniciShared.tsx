'use client'


export const RESOURCE_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: 'RANDEVULAR',
    items: [
      { key: 'randevu_sube', label: 'Randevu (Şube)' },
      { key: 'randevu_tum', label: 'Randevu (Tüm)' },
    ],
  },
  {
    title: 'HASTALAR',
    items: [
      { key: 'hasta_liste', label: 'Liste' },
      { key: 'hasta_karti', label: 'Hasta Kartı' },
      { key: 'oral_kendi', label: 'Oral (Kendi)' },
      { key: 'oral_sube', label: 'Oral (Şube)' },
      { key: 'oral_tum', label: 'Oral (Tüm)' },
      { key: 'not_goruntu', label: 'Not & Görüntü' },
      { key: 'hesap_sube', label: 'Hesap (Şube)' },
      { key: 'hesap_tum', label: 'Hesap (Tüm)' },
      { key: 'fatura', label: 'Fatura' },
      { key: 'recete', label: 'Reçete' },
    ],
  },
  {
    title: 'FİNANS',
    items: [
      { key: 'finans_bilgi_sube', label: 'Bilgi (Şube)' },
      { key: 'finans_bilgi_tum', label: 'Bilgi (Tüm)' },
      { key: 'finans_borclar_sube', label: 'Borçlar (Şube)' },
      { key: 'finans_borclar_tum', label: 'Borçlar (Tüm)' },
      { key: 'finans_defter_sube', label: 'Defter (Şube)' },
      { key: 'finans_defter_tum', label: 'Defter (Tüm)' },
      { key: 'finans_bakiye_sube', label: 'Bakiye (Şube)' },
      { key: 'finans_bakiye_tum', label: 'Bakiye (Tüm)' },
      { key: 'hakedis_kendi', label: 'Hakediş — Kendi' },
      { key: 'hakedis_tum', label: 'Hakediş — Tüm Hekimler' },
      { key: 'is_ortaklari', label: 'İş Ortaklarımız' },
    ],
  },
  {
    title: 'AYARLAR',
    items: [
      { key: 'ayarlar_klinik', label: 'Klinik' },
      { key: 'ayarlar_hekim', label: 'Hekim' },
      { key: 'ayarlar_kullanici', label: 'Kullanıcı' },
      { key: 'ayarlar_tarife', label: 'Tarife' },
      { key: 'ayarlar_randevu', label: 'Randevu Ayarları' },
    ],
  },
]
export function IconShield() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" /><path d="m9 12 2 2 4-5" /></svg>
}
