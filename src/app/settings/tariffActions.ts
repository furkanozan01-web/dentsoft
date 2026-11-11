'use server'

import { revalidatePath } from 'next/cache'
import { getCtx, requireAdmin, type R } from './actionsShared'

// ---- Tarife ----
export async function deleteTariffItem(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const id = Number(formData.get('id'))
  if (!id) return { error: 'ID gerekli' }

  const { error } = await supabase.from('tariffs').delete().eq('id', id).eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- TDB 2024 Tarife İçe Aktar ----
// Fiyatlar kuruş cinsinden (Toplam / KDV dahil)
type TdbItem = { treatment_name: string; price: number }
type TdbCategory = { category: string; items: TdbItem[] }

const TDB_2024: TdbCategory[] = [
  {
    category: 'Muayene ve Teşhis',
    items: [
      { treatment_name: 'Dişhekimi Muayenesi', price: 25000 },
      { treatment_name: 'Uzman Dişhekimi Muayenesi', price: 75000 },
      { treatment_name: 'Kontrol Hekim Muayenesi', price: 71500 },
      { treatment_name: 'Konsültasyon', price: 60000 },
      { treatment_name: 'Uzman Diş Hekimi Konsültasyonu', price: 75500 },
      { treatment_name: 'Diş Röntgen Filmi (Periapikal)', price: 34000 },
      { treatment_name: 'Bite Wing Radyografi', price: 34000 },
      { treatment_name: 'Oklüzal Film', price: 37000 },
      { treatment_name: 'Exstra Oral Röntgen Filmi', price: 43000 },
      { treatment_name: 'Panoramik Film', price: 40000 },
      { treatment_name: 'Lateral Sefalometrik Film', price: 111500 },
      { treatment_name: 'Antero-Posterior Sefalometrik Film', price: 110000 },
      { treatment_name: 'Radyo Vizyografi (RVG)', price: 48500 },
      { treatment_name: 'Bilgisayarlı Tomografi (Bölgesel)', price: 119500 },
      { treatment_name: 'Bilgisayarlı Tomografi (Tek Çene)', price: 295000 },
      { treatment_name: 'Bilgisayarlı Tomografi (İki Çene)', price: 364000 },
      { treatment_name: 'Ağız İçi Dijital Tarama', price: 275000 },
      { treatment_name: 'T.M.E. Filmi ve Tetkiki', price: 165500 },
      { treatment_name: 'Oral Hijyen Eğitimi', price: 50000 },
      { treatment_name: 'Vitalite Kontrolü (Diş Başına)', price: 11000 },
      { treatment_name: 'Lokal Anestezi (İnfiltratif)', price: 15000 },
      { treatment_name: 'Lokal Anestezi (Rejyonal)', price: 15000 },
      { treatment_name: 'Teşhis ve Tedavi Planlaması', price: 94500 },
      { treatment_name: 'Bilinçli Sedasyon', price: 47000 },
    ],
  },
  {
    category: 'Endodonti (Kanal Tedavisi)',
    items: [
      { treatment_name: 'Kanal Tedavisi (Tek Kanal)', price: 300000 },
      { treatment_name: 'Kanal Tedavisi (İki Kanal)', price: 364500 },
      { treatment_name: 'Kanal Tedavisi (Üç Kanal)', price: 400000 },
      { treatment_name: 'Kanal Tedavisi (İlave Her Kanal)', price: 135000 },
      { treatment_name: 'Kanal Tedavisi (Biyoseramik)', price: 520000 },
      { treatment_name: 'Kanal Yenileme (Retreatment)', price: 800000 },
      { treatment_name: 'Kanal Dolgusu Sökümü (Her Kanal)', price: 99000 },
      { treatment_name: 'Kanal Dolgusu Tekrarı (Her Kanal)', price: 200000 },
      { treatment_name: 'Periapikal Lezyonlu Diş — Tek Kanal', price: 253500 },
      { treatment_name: 'Periapikal Lezyonlu Diş — İki Kanal', price: 375500 },
      { treatment_name: 'Periapikal Lezyonlu Diş — Üç Kanal', price: 519000 },
      { treatment_name: 'Kanaldan Kırılmış Materyal Çıkarma', price: 322000 },
      { treatment_name: 'Kanalda Perforasyon Tamiri (MTA)', price: 169500 },
      { treatment_name: 'Endokron', price: 500000 },
      { treatment_name: 'Ekstirpasyon (Her Kanal)', price: 95500 },
      { treatment_name: 'Pansuman (Seans Başı)', price: 47000 },
      { treatment_name: 'Kanal Pansumanı (Seans Başı)', price: 61000 },
      { treatment_name: 'Rubber-Dam Uygulaması', price: 57000 },
      { treatment_name: 'Dolgu Sökümü (Tek Diş)', price: 42000 },
      { treatment_name: 'Dolgu (Restorasyon) Tamiri', price: 161500 },
    ],
  },
  {
    category: 'Konservatif Diş Tedavisi',
    items: [
      { treatment_name: 'Kompozit Dolgu (1 Yüzlü)', price: 164000 },
      { treatment_name: 'Kompozit Dolgu (2 Yüzlü)', price: 205500 },
      { treatment_name: 'Kompozit Dolgu (3 Yüzlü — MOD)', price: 256000 },
      { treatment_name: 'Amalgam Dolgu (1 Yüzlü)', price: 146500 },
      { treatment_name: 'Amalgam Dolgu (2 Yüzlü)', price: 187000 },
      { treatment_name: 'Amalgam Dolgu (3 Yüzlü — MOD)', price: 234500 },
      { treatment_name: 'Cam İonomer Dolgu', price: 125000 },
      { treatment_name: 'İnley Dolgu (1 Yüzlü)', price: 335500 },
      { treatment_name: 'İnley Dolgu (2 Yüzlü)', price: 342500 },
      { treatment_name: 'İnley Dolgu (3 Yüzlü — MOD)', price: 352000 },
      { treatment_name: 'Kompozit İnley (1 Yüzlü)', price: 288000 },
      { treatment_name: 'Kompozit İnley (2 Yüzlü)', price: 330500 },
      { treatment_name: 'Kompozit İnley (3 Yüzlü)', price: 364000 },
      { treatment_name: 'Seramik İnley (1 Yüzlü)', price: 841500 },
      { treatment_name: 'Seramik İnley (2 Yüzlü)', price: 991000 },
      { treatment_name: 'Seramik İnley (3 Yüzlü)', price: 1046000 },
      { treatment_name: 'Onley', price: 412000 },
      { treatment_name: 'Onley (Seramik)', price: 1056500 },
      { treatment_name: 'Estetik Dolgu', price: 350000 },
      { treatment_name: 'Fissür Örtülmesi (Sealant — Tek Diş)', price: 50000 },
      { treatment_name: 'Kuafaj (Dolgu Hariç)', price: 22500 },
      { treatment_name: 'Direkt Kompozit Veneer Restorasyon', price: 457500 },
      { treatment_name: 'Laminate Veneer (Kompozit)', price: 500000 },
      { treatment_name: 'Kanal İçi Hazır Post Uygulaması', price: 150000 },
      { treatment_name: 'Kanal İçi Fiber Post Uygulaması', price: 200000 },
      { treatment_name: 'Diş Ağartma — Devital (Tek Diş)', price: 400000 },
      { treatment_name: 'Diş Ağartma — Vital (Tek Çene)', price: 600000 },
      { treatment_name: 'Diastema Kapatma (Diş Başına)', price: 300000 },
    ],
  },
  {
    category: 'Protez',
    items: [
      { treatment_name: 'Tam Protez — Akrilik (Tek Çene)', price: 1700000 },
      { treatment_name: 'Tam Protez — Metal (Tek Çene)', price: 2200000 },
      { treatment_name: 'Bölümlü Protez — Akrilik (Tek Çene)', price: 1200000 },
      { treatment_name: 'Bölümlü Protez — Metal (Tek Çene)', price: 1500000 },
      { treatment_name: 'Hassas Tutuculu Protez (Tek Çene)', price: 3000000 },
      { treatment_name: 'Gece Plağı (Sert Oklüzal Splint)', price: 500000 },
      { treatment_name: 'Gece Plağı (Yumuşak)', price: 316500 },
      { treatment_name: 'Zirkonyum Kuron', price: 750000 },
      { treatment_name: 'Tam Seramik Kuron (Metal Desteksiz)', price: 1261000 },
      { treatment_name: 'Laminate Veneer Kuron (Seramik)', price: 1200000 },
      { treatment_name: 'Veneer Kuron (Seramik)', price: 603500 },
      { treatment_name: 'Tek Parça Döküm Kuron', price: 579000 },
      { treatment_name: 'Jaket Kuron (Seramik)', price: 381000 },
      { treatment_name: 'Geçici Kuron (Tek Diş)', price: 111500 },
      { treatment_name: 'Kuron Sökümü', price: 94000 },
      { treatment_name: 'Döküm Post Core (Pivo)', price: 385000 },
      { treatment_name: 'Adeziv Köprü (Maryland)', price: 594500 },
      { treatment_name: 'Pontik', price: 175000 },
      { treatment_name: 'Metal Destekli Porselen', price: 175000 },
      { treatment_name: 'Porselen', price: 500000 },
      { treatment_name: 'Katana', price: 900000 },
      { treatment_name: 'Besleme (Tek Çene)', price: 400000 },
      { treatment_name: 'Kaide Yenileme — Rebazaj (Tek Çene)', price: 1000000 },
      { treatment_name: 'Protez Tamiri (Akrilik)', price: 100000 },
      { treatment_name: 'Diş İlavesi (Tek Diş)', price: 150000 },
    ],
  },
  {
    category: 'Ağız, Diş ve Çene Cerrahisi',
    items: [
      { treatment_name: 'Diş Çekimi', price: 100000 },
      { treatment_name: 'Komplikasyonlu Diş Çekimi', price: 100000 },
      { treatment_name: 'Gömülü Diş Operasyonu', price: 500000 },
      { treatment_name: 'Gömülü Diş Operasyonu (Kemik Retansiyonlu)', price: 300000 },
      { treatment_name: 'Koronektomi', price: 1045000 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (Tek Köklü)', price: 500000 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (İki Köklü)', price: 584500 },
      { treatment_name: 'Kök Ucu Rezeksiyonu (Üç Köklü)', price: 669500 },
      { treatment_name: 'Kist Operasyonu (Basit)', price: 600000 },
      { treatment_name: 'Kist Operasyonu (Komplike)', price: 694500 },
      { treatment_name: 'Frenektomi Operasyonu', price: 600000 },
      { treatment_name: 'Biyopsi', price: 377000 },
      { treatment_name: 'Epulis Operasyonu', price: 200000 },
      { treatment_name: 'Apse Drenajı (İntraoral)', price: 469000 },
      { treatment_name: 'Apse Drenajı (Extraoral)', price: 542500 },
      { treatment_name: 'Alveolit Cerrahi Tedavisi', price: 150000 },
      { treatment_name: 'Alveol Plastiği (Yarım Çene)', price: 480500 },
      { treatment_name: 'Sinüs Lifting (Biomateryal Hariç)', price: 654500 },
      { treatment_name: 'Açık Sinüs Lift', price: 400000 },
      { treatment_name: 'Sert Doku Greftleme (Greft Hariç)', price: 705000 },
      { treatment_name: 'Yumuşak Doku Greftleme (Greft Hariç)', price: 610500 },
      { treatment_name: 'Kemik İçi İmplant (İmplant Ücreti Hariç)', price: 1397500 },
      { treatment_name: 'İmplant Çıkarılması', price: 533500 },
      { treatment_name: 'Botoks Uygulama (İlaç Hariç)', price: 627500 },
      { treatment_name: 'Kapişon İzalesi / İmplant Üstü Açılması', price: 219000 },
    ],
  },
  {
    category: 'Periodontoloji',
    items: [
      { treatment_name: 'Detertraj — Diş Taşı Temizliği (Tek Çene)', price: 200000 },
      { treatment_name: 'Subgingival Küretaj (Tek Diş)', price: 300000 },
      { treatment_name: 'Gingivektomi (Tek Diş)', price: 500000 },
      { treatment_name: 'Gingivoplasti (Tek Diş)', price: 161500 },
      { treatment_name: 'Flap Operasyonu (Tek Diş)', price: 1500000 },
      { treatment_name: 'Periodontal Apse Tedavisi', price: 187000 },
      { treatment_name: 'Periodontal Şine — Daimi', price: 366500 },
      { treatment_name: 'Periodontal Şine — Geçici', price: 549000 },
      { treatment_name: 'Serbest Diş Eti Grefti', price: 217500 },
      { treatment_name: 'Subepitelyal Bağ Dokusu Grefti', price: 331000 },
      { treatment_name: 'Peri-İmplantitis Cerrahi (Tek İmplant)', price: 364000 },
      { treatment_name: 'Peri-İmplantitis Cerrahi Olmayan (Tek İmplant)', price: 152500 },
      { treatment_name: 'Polisaj', price: 70000 },
      { treatment_name: 'Yüzeysel Flor Uygulaması (Yarım Çene)', price: 50000 },
    ],
  },
  {
    category: 'Pedodonti',
    items: [
      { treatment_name: 'Süt Dişi Kanal Tedavisi', price: 289500 },
      { treatment_name: 'Amputasyon Vital (Pulpotomi)', price: 150000 },
      { treatment_name: 'Kompomer Dolgu', price: 194500 },
      { treatment_name: 'Prefabrike Kron', price: 192000 },
      { treatment_name: 'Strip Kron', price: 188000 },
      { treatment_name: 'Fissür Örtülmesi (Tek Diş)', price: 50000 },
      { treatment_name: 'Yer Tutucu (Sabit)', price: 350000 },
      { treatment_name: 'Yer Tutucu (Hareketli)', price: 600000 },
      { treatment_name: 'Travma Splinti', price: 150000 },
      { treatment_name: 'Açık Apeksli Dişte Kanal Tedavisi (Her Kanal)', price: 600000 },
    ],
  },
  {
    category: 'Ortodonti',
    items: [
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf I)', price: 1585500 },
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf II)', price: 2007500 },
      { treatment_name: 'Sabit Ortodonti Tedavisi (Sınıf III)', price: 2452000 },
      { treatment_name: 'Sabit Tedavi', price: 10000000 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Hafif)', price: 2625500 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Orta)', price: 3625000 },
      { treatment_name: 'Şeffaf Plak Tedavisi (Ağır)', price: 4931000 },
      { treatment_name: 'Pekiştirme Tedavisi', price: 422000 },
      { treatment_name: 'Sabit Pekiştirme — Lingual Retainer', price: 522000 },
      { treatment_name: 'Önleyici Ortodontik Tedavi', price: 1136500 },
      { treatment_name: 'Tek Çeneyi İlgilendiren Aparey', price: 384500 },
      { treatment_name: 'Hızlı Maksiller Genişletme Apareyi', price: 682000 },
      { treatment_name: 'Nance Apareyi', price: 567500 },
      { treatment_name: 'Lingual Ark', price: 400500 },
      { treatment_name: 'Ağız İçi Koruyucu Aparey', price: 1100000 },
      { treatment_name: 'Lateral Sefalometrik Film Analizi', price: 79000 },
      { treatment_name: 'Bilgisayarlı Sefalometrik Film Analizi', price: 132000 },
      { treatment_name: 'Ortodontik Fotoğraf', price: 45500 },
      { treatment_name: 'Ortodontik Model Yapımı', price: 64000 },
    ],
  },
]

// TDB_CURRENT_YEAR: her yeni TDB tarifesi yayınlandığında bu sabiti ve TDB_2024 verisini güncelle
const TDB_CURRENT_YEAR = 2024

export type TariffProfile = {
  id: number
  name: string
  source: 'tdb' | 'custom'
  tdb_year: number | null
  is_default: boolean
  last_synced_at: string | null
  created_at: string
}

export async function importTdb2024(_prev: R, formData: FormData): Promise<R> {
  void _prev
  void formData
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  // Mevcut TDB profili var mı kontrol et
  const { data: existing } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('source', 'tdb')
    .eq('tdb_year', TDB_CURRENT_YEAR)
    .maybeSingle()
  if (existing) return { error: `TDB ${TDB_CURRENT_YEAR} tarifesi zaten mevcut. Güncellemek için profil üzerindeki "Yenile" düğmesini kullanın.` }

  // Profil oluştur
  const { data: profile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: `TDB ${TDB_CURRENT_YEAR}`, source: 'tdb', tdb_year: TDB_CURRENT_YEAR, last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (profileErr || !profile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const rows = TDB_2024.flatMap(({ category, items }) =>
    items.map(({ treatment_name, price }) => ({
      clinic_id: clinicId,
      profile_id: profile.id,
      category,
      treatment_name,
      price,
      currency: 'TRY',
      is_active: true,
    }))
  )

  const { error } = await supabase.from('tariffs').insert(rows)
  if (error) {
    await supabase.from('tariff_profiles').delete().eq('id', profile.id)
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function syncTdbProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  // Profili bu kliniğe ait ve TDB kaynaklı olduğunu doğrula
  const { data: prof } = await supabase
    .from('tariff_profiles')
    .select('id, tdb_year')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .eq('source', 'tdb')
    .single()
  if (!prof) return { error: 'Profil bulunamadı' }

  // Atomik upsert (sync_tdb_tariffs RPC): mevcut kalemler yerinde güncellenir, tedavi/plan bağlantıları korunur
  const items = TDB_2024.flatMap(({ category, items }) =>
    items.map(({ treatment_name, price }) => ({
      category,
      treatment_name,
      price,
      currency: 'TRY',
    }))
  )
  const { error } = await supabase.rpc('sync_tdb_tariffs', {
    p_profile_id: profileId,
    p_clinic_id: clinicId,
    p_items: items,
  })
  if (error) return { error: error.message }

  await supabase
    .from('tariff_profiles')
    .update({ tdb_year: TDB_CURRENT_YEAR, last_synced_at: new Date().toISOString() })
    .eq('id', profileId)

  revalidatePath('/settings')
  return { success: true }
}

// ---- Tufanbeyli Tarifesi ----
type TufanItem = { code: string; name: string; price: number; currency: string }
type TufanCategory = { category: string; items: TufanItem[] }

const TUFANBEYLI_DATA: TufanCategory[] = [
  {
    category: 'Endodonti',
    items: [
      { code: '02-999-996', name: 'Kanal Yenileme (Retreatment)', price: 800000, currency: 'TRY' },
      { code: '02-999-997', name: 'Kanal Tedavisi', price: 500000, currency: 'TRY' },
    ],
  },
  {
    category: 'Pedodonti',
    items: [
      { code: '03-001-001', name: 'Fissür Örtülmesi (Sealant-Tek Diş)', price: 50000, currency: 'TRY' },
      { code: '03-002-001', name: 'Yüzeysel Flor Uygulaması (Yarım Çene)', price: 50000, currency: 'TRY' },
      { code: '03-004-001', name: 'Yer Tutucu (Sabit)', price: 350000, currency: 'TRY' },
      { code: '03-005-001', name: 'Yer Tutucu (Hareketli)', price: 600000, currency: 'TRY' },
      { code: '03-016-001', name: 'Süt Dişi Kanal Tedavisi', price: 289500, currency: 'TRY' },
      { code: '03-999-998', name: 'Akrilik Yer Tutucu', price: 100000, currency: 'TRY' },
    ],
  },
  {
    category: 'Protez',
    items: [
      { code: '04-001-001', name: 'Tam Protez (Akrilik-Tek Çene)', price: 1700000, currency: 'TRY' },
      { code: '04-003-001', name: 'Tam Protez (Metal-Tek Çene)', price: 2200000, currency: 'TRY' },
      { code: '04-005-001', name: 'Hassas Tutuculu Protezler (Tek Çene)', price: 3000000, currency: 'TRY' },
      { code: '04-008-001', name: 'Besleme (Tek Çene)', price: 400000, currency: 'TRY' },
      { code: '04-009-001', name: 'Kaide Yenileme (Rebazaj - Tek Çene)', price: 1000000, currency: 'TRY' },
      { code: '04-011-001', name: 'Proteze Yumuşak Akrilik (Daimi Tek Çene)', price: 1000000, currency: 'TRY' },
      { code: '04-019-001', name: 'Gece Plağı (Bruksizm - Sert)', price: 500000, currency: 'TRY' },
      { code: '04-025-001', name: 'Laminate Veneer Kuron (Seramik)', price: 1200000, currency: 'TRY' },
      { code: '04-047-001', name: 'Zirkonyum Kuron', price: 750000, currency: 'TRY' },
      { code: '04-999-989', name: 'İmplant Üstü Multi', price: 6500000, currency: 'TRY' },
      { code: '04-999-990', name: 'İmplant Üstü Simante', price: 4600000, currency: 'TRY' },
      { code: '04-999-991', name: 'Porselen Hibrit Protez', price: 12000000, currency: 'TRY' },
      { code: '04-999-992', name: 'Katana', price: 900000, currency: 'TRY' },
      { code: '04-999-994', name: 'Porselen', price: 500000, currency: 'TRY' },
      { code: '04-999-996', name: 'Akrilik Hibrit Protez', price: 9000000, currency: 'TRY' },
    ],
  },
  {
    category: 'Ağız, Diş ve Çene Cerrahisi',
    items: [
      { code: '05-001-001', name: 'Diş Çekimi', price: 100000, currency: 'TRY' },
      { code: '05-003-001', name: 'Gömülü Diş Operasyonu', price: 500000, currency: 'TRY' },
      { code: '05-005-001', name: 'Tek Kökte Kök Ucu Rezeksiyonu', price: 500000, currency: 'TRY' },
      { code: '05-012-001', name: 'Kist Operasyonu (Basit)', price: 600000, currency: 'TRY' },
      { code: '05-016-001', name: 'Frenektomi Operasyonu', price: 600000, currency: 'TRY' },
      { code: '05-056-001', name: 'Koronektomi', price: 1045000, currency: 'TRY' },
      { code: '05-999-979', name: 'HiOSSen İmplant', price: 3500000, currency: 'TRY' },
      { code: '05-999-980', name: 'Bredent İmplant', price: 3400000, currency: 'TRY' },
      { code: '05-999-982', name: 'Osstem İmplant', price: 2500000, currency: 'TRY' },
      { code: '05-999-987', name: 'NucleOss İmplant', price: 2000000, currency: 'TRY' },
      { code: '05-999-988', name: 'DXL İmplant', price: 3000000, currency: 'TRY' },
      { code: '05-999-992', name: 'Açık Sinüs Lift', price: 400000, currency: 'TRY' },
      { code: '05-999-993', name: 'Membran Uygulaması', price: 11000, currency: 'EUR' },
      { code: '05-999-994', name: 'Greft Uygulaması (1cc)', price: 11000, currency: 'USD' },
    ],
  },
  {
    category: 'Periodontoloji',
    items: [
      { code: '06-002-001', name: 'Detertraj (Diş Taşı Temizliği-Tek Çene)', price: 200000, currency: 'TRY' },
      { code: '06-007-001', name: 'Flap Operasyonu (Tek Diş)', price: 1500000, currency: 'TRY' },
    ],
  },
  {
    category: 'Ortodonti',
    items: [
      { code: '07-025-001', name: 'Tek Çeneyi İlgilendiren Aparey Yapımı', price: 384500, currency: 'TRY' },
      { code: '07-069-001', name: 'Ağız İçi Koruyucu Aparey', price: 1100000, currency: 'TRY' },
      { code: '07-999-998', name: 'Sabit Tedavi', price: 10000000, currency: 'TRY' },
    ],
  },
  {
    category: 'Konservatif Diş Tedavisi',
    items: [
      { code: '08-018-001', name: 'Diş Ağartma (Devital Tek Diş)', price: 400000, currency: 'TRY' },
      { code: '08-019-001', name: 'Diş Ağartma (Tek Çene)', price: 600000, currency: 'TRY' },
      { code: '08-021-001', name: 'Kanal İçi Hazır Post Uygulaması', price: 150000, currency: 'TRY' },
      { code: '08-022-001', name: 'Kanal İçi Fiber Post Uygulaması', price: 200000, currency: 'TRY' },
      { code: '08-999-995', name: 'Estetik Dolgu', price: 350000, currency: 'TRY' },
      { code: '08-999-996', name: 'Laminate Veneer (Kompozit)', price: 500000, currency: 'TRY' },
      { code: '08-999-998', name: 'Dolgu', price: 250000, currency: 'TRY' },
    ],
  },
]

export async function importTufanbeyli(_prev: R, formData: FormData): Promise<R> {
  void _prev
  void formData
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { data: existing } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Tufanbeyli')
    .maybeSingle()
  if (existing) return { error: 'Tufanbeyli tarifesi zaten mevcut.' }

  const { data: profile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: 'Tufanbeyli', source: 'custom', last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (profileErr || !profile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const rows = TUFANBEYLI_DATA.flatMap(({ category, items }) =>
    items.map(({ code, name, price, currency }) => ({
      clinic_id: clinicId,
      profile_id: profile.id,
      category,
      treatment_name: name,
      treatment_code: code,
      price,
      currency,
      is_active: true,
    }))
  )

  const { error } = await supabase.from('tariffs').insert(rows)
  if (error) {
    await supabase.from('tariff_profiles').delete().eq('id', profile.id)
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Profil Yönetimi ----

export async function copyTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const sourceId = Number(formData.get('source_id'))
  const newName = (formData.get('new_name') as string)?.trim()
  if (!sourceId || !newName) return { error: 'Kaynak profil ve yeni ad gerekli' }

  const { data: newProfile, error: profileErr } = await supabase
    .from('tariff_profiles')
    .insert({ clinic_id: clinicId, name: newName, source: 'custom' })
    .select('id')
    .single()
  if (profileErr || !newProfile) return { error: profileErr?.message ?? 'Profil oluşturulamadı' }

  const { data: items } = await supabase
    .from('tariffs')
    .select('category, treatment_name, treatment_code, price, currency, is_active')
    .eq('profile_id', sourceId)
    .eq('clinic_id', clinicId)
  if (items?.length) {
    const rows = items.map((t) => ({
      clinic_id: clinicId,
      profile_id: newProfile.id,
      category: t.category,
      treatment_name: t.treatment_name,
      treatment_code: t.treatment_code,
      price: t.price,
      currency: t.currency,
      is_active: t.is_active,
    }))
    const { error } = await supabase.from('tariffs').insert(rows)
    if (error) {
      await supabase.from('tariff_profiles').delete().eq('id', newProfile.id).eq('clinic_id', clinicId)
      return { error: error.message }
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function deleteTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  const { error } = await supabase
    .from('tariff_profiles')
    .delete()
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function renameTariffProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  const name = (formData.get('name') as string)?.trim()
  if (!profileId || !name) return { error: 'Profil ID ve ad gerekli' }

  const { error } = await supabase
    .from('tariff_profiles')
    .update({ name })
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function setDefaultProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  if (!profileId) return { error: 'Profil ID gerekli' }

  const { data: profile, error: profileError } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (profileError) return { error: profileError.message }
  if (!profile) return { error: 'Tarife profili bulunamadı' }

  const { error: clearError } = await supabase
    .from('tariff_profiles')
    .update({ is_default: false })
    .eq('clinic_id', clinicId)
  if (clearError) return { error: clearError.message }
  const { error } = await supabase
    .from('tariff_profiles')
    .update({ is_default: true })
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ---- Tarife Kalemi İşlemleri ----

export async function toggleTariffItemActive(itemId: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const { data: current } = await supabase
    .from('tariffs')
    .select('is_active')
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
    .single()
  if (!current) return { error: 'Kalem bulunamadı' }

  const { error } = await supabase
    .from('tariffs')
    .update({ is_active: !current.is_active })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateTariffItemPrice(itemId: number, priceKurus: number): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: 'Geçersiz tarife kalemi' }
  if (!Number.isFinite(priceKurus) || priceKurus < 0) return { error: 'Geçerli bir fiyat girin' }

  const { error } = await supabase
    .from('tariffs')
    .update({ price: priceKurus })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/patients')
  return { success: true }
}

export async function bulkUpdateTariffPrices(input: {
  profileId: number
  tariffIds: number[]
  category: string | null
  branchId: number | null
  percent: number
  rounding: number
  roundDirection: 'nearest' | 'up' | 'down'
  vatMode: 'preserve' | 'included' | 'excluded'
  effectiveDate: string
  description: string
}): Promise<R & { count?: number }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  if (!Number.isInteger(input.profileId) || input.profileId <= 0) return { error: 'Geçersiz tarife profili' }
  if (!Number.isFinite(input.percent) || input.percent === 0 || Math.abs(input.percent) > 1000) return { error: 'Geçerli bir değişim oranı girin' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) return { error: 'Geçerli bir tarih seçin' }

  const { data, error } = await ctx.supabase.rpc('bulk_update_tariff_prices', {
    p_profile_id: input.profileId,
    p_tariff_ids: input.tariffIds,
    p_category: input.category,
    p_branch_id: input.branchId,
    p_percent: input.percent,
    p_rounding: input.rounding,
    p_round_direction: input.roundDirection,
    p_vat_mode: input.vatMode,
    p_effective_date: input.effectiveDate,
    p_description: input.description.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true, count: Number(data ?? 0) }
}

export async function updateTariffItemDuration(itemId: number, minutes: number | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: 'Geçersiz tarife kalemi' }
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 5 || minutes > 24 * 60)) {
    return { error: 'Süre 5 dakika ile 24 saat arasında olmalıdır' }
  }

  const { error } = await supabase
    .from('tariffs')
    .update({ duration_minutes: minutes })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) {
    if (error.message.includes('duration_minutes') || error.code === '42703') {
      return { error: 'DB migration gerekli: supabase/migrations/20260623_duration_logo.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateTariffItemColor(itemId: number, color: string | null): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const normalized = color?.trim() || null
  if (normalized && !/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return { error: 'Renk kodu #RRGGBB formatında olmalı' }
  }

  const { error } = await supabase
    .from('tariffs')
    .update({ color: normalized })
    .eq('id', itemId)
    .eq('clinic_id', clinicId)
  if (error) {
    if (error.message.includes('color') || error.code === '42703') {
      return { error: 'DB migration gerekli: supabase/migrations/20260625_tariff_colors.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }
  revalidatePath('/settings')
  revalidatePath('/appointments')
  return { success: true }
}

export async function updateTariffItemDetails(itemId: number, input: { name: string; price: number; visualSchema: string }): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const name = input.name.trim()
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: 'Geçersiz tarife kalemi' }
  if (!name) return { error: 'Tedavi adı zorunludur' }
  if (!Number.isFinite(input.price) || input.price < 0) return { error: 'Geçerli bir fiyat girin' }
  const validSchemas = ['exam','cleaning','filling','root-canal','crown','porcelain','zirconium','emax','extraction','surgery','implant','bone-graft','sinus-lift','whitening','orthodontics','prosthesis','removable','total-prosthesis','night-guard','smile','pedo','periodontal']
  const selectedSchemas = input.visualSchema.split('+').filter(Boolean)
  if (!selectedSchemas.length || selectedSchemas.some((schema) => !validSchemas.includes(schema))) return { error: 'Geçersiz tedavi şeması' }

  const { error } = await ctx.supabase.from('tariffs').update({
    treatment_name: name,
    price: Math.round(input.price),
    visual_schema: input.visualSchema,
  }).eq('id', itemId).eq('clinic_id', ctx.clinicId)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/patients')
  return { success: true }
}

export async function addTariffItemToProfile(_prev: R, formData: FormData): Promise<R> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return adminErr
  const { supabase, clinicId } = ctx

  const profileId = Number(formData.get('profile_id'))
  const treatment_name = (formData.get('treatment_name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const treatment_code = (formData.get('treatment_code') as string)?.trim() || null
  const currency = (formData.get('currency') as string) || 'TRY'
  const color = (formData.get('color') as string)?.trim() || null
  const visual_schema = (formData.get('visual_schema') as string)?.trim() || null
  const application_region = (formData.get('application_region') as string)?.trim() || null
  const vat_rate = Math.max(0, Math.min(100, Number(formData.get('vat_rate') ?? 0)))
  const vat_included = formData.get('vat_included') !== 'false'
  const branchIdRaw = Number(formData.get('branch_id'))
  const branch_id = Number.isInteger(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null
  const priceStr = (formData.get('price') as string)?.replace(',', '.').replace(/[^0-9.]/g, '')
  const price = Math.round(parseFloat(priceStr || '0') * 100)

  if (!profileId || !treatment_name || !category) return { error: 'Profil, işlem adı ve kategori zorunludur' }

  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return { error: 'Renk kodu #RRGGBB formatında olmalı' }

  const { data: tariffProfile } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('clinic_id', clinicId)
    .single()
  if (!tariffProfile) return { error: 'Profil bulunamadı' }

  const { error } = await supabase.from('tariffs').insert({
    clinic_id: clinicId,
    profile_id: profileId,
    treatment_name,
    category,
    treatment_code,
    price,
    currency,
    color,
    visual_schema,
    application_region,
    vat_rate,
    vat_included,
    branch_id,
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/patients')
  return { success: true }
}
