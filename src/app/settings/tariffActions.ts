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

// ---- TDB 2026 Tarife İçe Aktar ----
// Kaynak: TDB 2026 Asgari Diş Hekimliği Ücret Tarifesi (resmî PDF; pdf.js ile doğrudan metin katmanından okundu); fiyatlar KDV dahil, kuruş.
// Fiyatlar kuruş cinsinden (Toplam / KDV dahil)
type TdbItem = { treatment_name: string; price: number }
type TdbCategory = { category: string; items: TdbItem[] }

const TDB_2026: TdbCategory[] = [
  {
    category: 'Muayene ve Teşhis',
    items: [
      { treatment_name: 'Dişhekimi Muayenesi', price: 165000 },
      { treatment_name: 'Uzman Dişhekimi Muayenesi', price: 203500 },
      { treatment_name: 'Kontrol Hekim Muayenesi', price: 143000 },
      { treatment_name: 'Konsültasyon', price: 111000 },
      { treatment_name: 'Uzman Dişhekimi Konsültasyonu', price: 144500 },
      { treatment_name: 'Hipnoz (Seans Başına)', price: 158000 },
      { treatment_name: 'Akupunktur Uygulama (Seans Başına)', price: 275000 },
      { treatment_name: 'Teşhis ve Tedavi Planlaması', price: 153500 },
      { treatment_name: 'Oral Hijyen Eğitimi', price: 117500 },
      { treatment_name: 'Tükürük Akış Hızı ve Tamponlama Kapasitesi Tayini', price: 167000 },
      { treatment_name: 'Tükürükte Mikrobiyolojik Analiz', price: 280500 },
      { treatment_name: 'Gnatoloji, T.M.E. Kas Muayenesi (Oklüzyon Kontrolü)', price: 528000 },
      { treatment_name: 'Vitalite Kontrolü (Diş Başına)', price: 23500 },
      { treatment_name: 'Diş Röntgen Filmi (Periapikal)', price: 83000 },
      { treatment_name: 'Oklüzal Film', price: 86500 },
      { treatment_name: 'Bite - Wing Radyografi', price: 83000 },
      { treatment_name: 'Ekstra Oral Röntgen Filmi', price: 95500 },
      { treatment_name: 'Panoramik Film', price: 204000 },
      { treatment_name: 'Lateral Sefalometrik Film', price: 205000 },
      { treatment_name: 'Antero-Posterior Sefalometrik Film', price: 203000 },
      { treatment_name: 'İntra Oral Dijital Radyografi (RVG veya Fosfor Plak)', price: 99000 },
      { treatment_name: 'El Bilek Filmi', price: 203000 },
      { treatment_name: 'Siyalografi', price: 231000 },
      { treatment_name: 'Tomografi (Bölgesel)', price: 275000 },
      { treatment_name: 'Tomografi (Tek Çene)', price: 440000 },
      { treatment_name: 'Tomografi (İki Çene)', price: 594000 },
      { treatment_name: 'Eklem Tomografisi (Çift Taraflı)', price: 666000 },
      { treatment_name: 'Bilgisayarlı Büyük T.M.E. Fonksiyon Testi', price: 1320000 },
      { treatment_name: 'Bilgisayarlı Kas Tonus Analizi', price: 599500 },
      { treatment_name: 'T.M.E. Filmi ve Tetkiki', price: 267000 },
      { treatment_name: 'Lokal Anestezi (Enjeksiyon - İnfiltratif)', price: 37000 },
      { treatment_name: 'Lokal Anestezi (Rejyonal)', price: 37000 },
      { treatment_name: 'Raporlama', price: 200000 },
      { treatment_name: 'Ağız İçi Dijital Tarama', price: 275000 },
    ],
  },
  {
    category: 'Konservatif Diş Tedavisi',
    items: [
      { treatment_name: 'Amalgam Dolgu (Bir Yüzlü)', price: 284500 },
      { treatment_name: 'Amalgam Dolgu (İki Yüzlü)', price: 380500 },
      { treatment_name: 'Amalgam Dolgu (Üç Yüzlü)', price: 484500 },
      { treatment_name: 'Kompozit Dolgu (Bir Yüzlü)', price: 337500 },
      { treatment_name: 'Kompozit Dolgu (İki Yüzlü)', price: 423500 },
      { treatment_name: 'Kompozit Dolgu (Üç Yüzlü)', price: 530000 },
      { treatment_name: 'Direkt Kompozit Laminate Restorasyonu', price: 929500 },
      { treatment_name: 'Black V Kole Dolgusu (Kompozit)', price: 272000 },
      { treatment_name: 'Cam İyonomer Dolgu', price: 267500 },
      { treatment_name: 'Black V Kole Dolgusu (Cam İyonomer)', price: 211500 },
      { treatment_name: 'İnley Dolgu * (Bir Yüzlü)', price: 628500 },
      { treatment_name: 'İnley Dolgu * (İki Yüzlü)', price: 649000 },
      { treatment_name: 'İnley Dolgu * (Üç Yüzlü)', price: 677000 },
      { treatment_name: 'Kompozit İnley Dolgu (Bir Yüzlü)', price: 605000 },
      { treatment_name: 'Kompozit İnley Dolgu (İki Yüzlü)', price: 605000 },
      { treatment_name: 'Kompozit İnley Dolgu (Üç Yüzlü)', price: 605000 },
      { treatment_name: 'Seramik İnley Dolgu (Bir Yüzlü)', price: 1562000 },
      { treatment_name: 'Seramik İnley Dolgu (İki Yüzlü)', price: 1562000 },
      { treatment_name: 'Seramik İnley Dolgu (Üç Yüzlü)', price: 1562000 },
      { treatment_name: 'Onley *', price: 778000 },
      { treatment_name: 'Onley * (Seramik)', price: 1562000 },
      { treatment_name: 'Pinley *', price: 786500 },
      { treatment_name: 'Dolgu (Restorasyon) Tamiri', price: 292000 },
      { treatment_name: 'Dolgu Sökümü (Tek Diş)', price: 148000 },
      { treatment_name: 'Kuafaj (Dolgu Hariç)', price: 44000 },
      { treatment_name: 'Dentin Pini Uygulaması (Her Pin Başına)', price: 55500 },
      { treatment_name: 'Endokron', price: 1375000 },
      { treatment_name: 'Hassasiyet Tedavisi (Tek Diş)', price: 122000 },
      { treatment_name: 'Hassasiyet Tedavisi (Tam Çene)', price: 352000 },
      { treatment_name: 'Diş Ağartma (Beyazlatma Vital Tek Diş En Çok 4 Adet) (Malzeme Ücreti Hariç)', price: 214500 },
      { treatment_name: 'Diş Ağartma (Beyazlatma - Devital Tek Diş ) (Seans Başına - Dolgu Hariç)', price: 247500 },
      { treatment_name: 'Diş Ağartma (Beyazlatma - Tek Çene) (Malzeme Ücreti Hariç)', price: 1193500 },
      { treatment_name: 'Rubber-Dam Uygulaması', price: 115500 },
    ],
  },
  {
    category: 'Endodonti (Kanal Tedavisi)',
    items: [
      { treatment_name: 'Ekstirpasyon (Her Kanal İçin)', price: 201000 },
      { treatment_name: 'Kanal Tedavisi - Tek Kanal (Dolgu Hariç)', price: 461000 },
      { treatment_name: 'Kanal Tedavisi - İki Kanal (Dolgu Hariç)', price: 722000 },
      { treatment_name: 'Kanal Tedavisi - Üç Kanal (Dolgu Hariç)', price: 1035000 },
      { treatment_name: 'Kanal Tedavisi - İlave Her Kanal İçin', price: 250000 },
      { treatment_name: 'Periapikal Lezyonlu Dişte Kanal Tedavisi - Tek Kanal (Dolgu Hariç)', price: 505500 },
      { treatment_name: 'Periapikal Lezyonlu Dişte Kanal Tedavisi - İki Kanal (Dolgu Hariç)', price: 770000 },
      { treatment_name: 'Periapikal Lezyonlu Dişte Kanal Tedavisi - Üç Kanal (Dolgu Hariç)', price: 1098000 },
      { treatment_name: 'Kanal Dolgusu Sökümü (Her Kanal İçin)', price: 174000 },
      { treatment_name: 'Kanal Dolgusu Tekrarı (Retreatment - Her Kanal İçin - Dolgu Hariç)', price: 451000 },
      { treatment_name: 'Kanal Pansumanı (Seans Başı)', price: 120500 },
      { treatment_name: 'Kanal İçi Hazır Post Uygulaması (Metal) (Dolgu Ücreti Hariç)', price: 307500 },
      { treatment_name: 'Kanal İçi Fiber Post Uygulaması (Dolgu Ücreti Hariç)', price: 495000 },
      { treatment_name: 'Kanaldan Kırılmış Materyal Çıkartılması', price: 687500 },
      { treatment_name: 'Kanalda Perforasyon Tamiri (MTA vb.)', price: 328000 },
    ],
  },
  {
    category: 'Pedodonti',
    items: [
      { treatment_name: 'Aşındırma ile Sürme Rehberliği (Seans Başına)', price: 164000 },
      { treatment_name: 'Fissür Örtülmesi (Sealant - Tek Diş)', price: 144500 },
      { treatment_name: 'Yüzeysel Flor Uygulaması (Yarım Çene)', price: 137500 },
      { treatment_name: 'Kompomer Dolgu', price: 418000 },
      { treatment_name: 'Rezin İnfiltrasyonu Tedavisi', price: 715000 },
      { treatment_name: 'Amputasyon (Dolgu-Kron Üst Yapı-Biyomateryal Hariç)', price: 385000 },
      { treatment_name: 'Süt Dişi Kanal Tedavisi', price: 676500 },
      { treatment_name: 'Açık Apeksli Dişte Kanal Tedavisi (Her Kanal İçin - Dolgu Hariç) (Pansuman Ücretleri Hariç)', price: 1278000 },
      { treatment_name: 'Açık Apeksli Dişte Apikal Bariyer (Her Kanal İçin - Dolgu ve Pansuman Ücretleri Hariç)', price: 583000 },
      { treatment_name: 'Yer Tutucu (Sabit)', price: 748000 },
      { treatment_name: 'Yer Tutucu (Hareketli)', price: 1001000 },
      { treatment_name: 'Prefabrike Kron *', price: 381000 },
      { treatment_name: 'Strip Kron', price: 357500 },
      { treatment_name: 'Travma Splinti', price: 819500 },
      { treatment_name: 'Çocuk Protezi', price: 935000 },
      { treatment_name: 'Çocuk Protezi (Akrilik - Bölümlü - Tek Çene)', price: 1505000 },
      { treatment_name: 'Çocuk Protezi (Akrilik - Tam - Tek Çene)', price: 1699500 },
      { treatment_name: 'Avülsiyon Tedavisi', price: 1870000 },
    ],
  },
  {
    category: 'Protez',
    items: [
      { treatment_name: 'Tam Protez (Akrilik - Tek Çene)', price: 3190000 },
      { treatment_name: 'Bölümlü Protez (Akrilik - Tek Çene)', price: 3069000 },
      { treatment_name: 'Tam Protez (Döküm Metal ile Güçlendirilmiş - Tek Çene)', price: 3960000 },
      { treatment_name: 'Bölümlü Protez (Döküm Metal ile Güçlendirilmiş - Tek Çene)', price: 3850000 },
      { treatment_name: 'Hassas Tutuculu Protezler (Hassas Tutucu Ücreti Hariç - Tek Çene)', price: 4015000 },
      { treatment_name: 'İmplant Destekli Hareketli Protezler (Hassas Tutucu Ücreti Hariç - Tek Çene)', price: 4070000 },
      { treatment_name: 'Geçici (İmmediat) Protez (Akrilik - Tek Çene)', price: 2228500 },
      { treatment_name: 'Besleme (Tek Çene)', price: 1196500 },
      { treatment_name: 'Kaide Yenileme (Rebazaj - Tek Çene)', price: 1243000 },
      { treatment_name: 'Proteze Yumuşak Akrilik Uygulaması (Geçici Tek Çene)', price: 807000 },
      { treatment_name: 'Proteze Yumuşak Akrilik Uygulaması (Daimi Tek Çene)', price: 1261000 },
      { treatment_name: 'Tamir (Akrilik Protezler, Kırık veya Çatlak)', price: 380500 },
      { treatment_name: 'Kroşe İlavesi', price: 429000 },
      { treatment_name: 'Metal İskelet Tamiri', price: 418000 },
      { treatment_name: 'Diş İlavesi (Tek Diş)', price: 418000 },
      { treatment_name: 'Roach Köprü', price: 764500 },
      { treatment_name: 'Gece Plağı (Yumuşak)', price: 588500 },
      { treatment_name: 'Gece Plağı (Sert Oklüzal Splintleme)', price: 2024000 },
      { treatment_name: 'Pinley ve Çeşitleri *', price: 874000 },
      { treatment_name: 'Tek Parça Döküm Kuron', price: 773500 },
      { treatment_name: 'Veneer Kuron (Akrilik)', price: 1122000 },
      { treatment_name: 'Veneer Kuron ** (Seramik)', price: 1210000 },
      { treatment_name: 'İmplant Üstü Veneer Kuron (Seramik) (Abutment Ücreti Hariç)', price: 1368000 },
      { treatment_name: 'Laminate Veneer Kompozit', price: 929500 },
      { treatment_name: 'Laminate Veneer (Akrilik)', price: 1078500 },
      { treatment_name: 'Laminate Veneer (Seramik)', price: 2640000 },
      { treatment_name: 'Jaket Kuron (Akrilik)', price: 748000 },
      { treatment_name: 'Jaket Kuron (Kompozit)', price: 720500 },
      { treatment_name: 'Tam Seramik Kuron (Metal Desteksiz)', price: 2145000 },
      { treatment_name: 'Teleskop Kuron* (Koping)', price: 989500 },
      { treatment_name: 'Kuronlarda Freze Tekniği Farkı', price: 159500 },
      { treatment_name: 'Döküm Post Core (Pivo) (Üst Yapı Hariç)', price: 686000 },
      { treatment_name: 'Adeziv Köprü (Maryland vb. gibi)', price: 1155000 },
      { treatment_name: 'Geçici Kuron (Tek Diş İçin)', price: 224500 },
      { treatment_name: 'Kuron Sökümü (Tek Sabit Üye İçin)', price: 187500 },
      { treatment_name: 'Düşmüş Kuron ve Köprü Simantasyonu (Her Sabit Üye İçin)', price: 122500 },
      { treatment_name: 'Kuron Köprü Tamiri * (Her Üye İçin)', price: 500500 },
      { treatment_name: 'Diş Üstü Protezi (Overdenture - Tek Çene) (**)', price: 2605500 },
      { treatment_name: 'Damak Yarığı Protezi (Velum Uzantılı Aparey) (**)', price: 2618500 },
      { treatment_name: 'Yeni Doğanda Preoperatif Aparey (Vida Ücreti Ayrıca Alınır) (**)', price: 2203000 },
      { treatment_name: 'Geçici Obturatörler (**)', price: 1923500 },
      { treatment_name: 'Basit Çene Defektlerinde Protetik Tedavi (**)', price: 3521000 },
      { treatment_name: 'Komplike Çene Defektlerinde Protetik Tedavi (**)', price: 4227500 },
      { treatment_name: 'Yüz Protezleri (Yumuşak Akrilik İle)', price: 6875000 },
      { treatment_name: 'Göz Protezi (Oküler)', price: 7269500 },
      { treatment_name: 'Oklüzal Aşındırmalar', price: 682000 },
      { treatment_name: 'Oklüzyon Düzeltilmesi', price: 1015000 },
      { treatment_name: 'T.M.E. Stabilizasyon Splinti', price: 1980000 },
      { treatment_name: 'İmplant Rehberi (Yarım Çene)', price: 973500 },
      { treatment_name: 'İmplant Rehberi (Tam Çene)', price: 1430000 },
      { treatment_name: 'Zirkonyum Kron', price: 1375000 },
    ],
  },
  {
    category: 'Ağız, Diş ve Çene Cerrahisi',
    items: [
      { treatment_name: 'Diş Çekimi', price: 247500 },
      { treatment_name: 'Komplikasyonlu Diş Çekimi', price: 495000 },
      { treatment_name: 'Gömülü Diş Operasyonu', price: 797500 },
      { treatment_name: 'Gömülü Diş Operasyonu (Kemik Retansiyonlu)', price: 1171500 },
      { treatment_name: 'Tek Kökte Kök Ucu Rezeksiyonu (Kanal Tedavisi ve Dolgu Hariç)', price: 1045000 },
      { treatment_name: 'İki Kökte Kök Ucu Rezeksiyonu (Kanal Tedavisi ve Dolgu Hariç)', price: 1292500 },
      { treatment_name: 'Üç Kökte Kök Ucu Rezeksiyonu (Kanal Tedavisi ve Dolgu Hariç)', price: 1512500 },
      { treatment_name: 'Alveolit Cerrahi Tedavisi', price: 745500 },
      { treatment_name: 'Kanama Müdahalesi (Basit)', price: 256000 },
      { treatment_name: 'Kanama Müdahalesi (Dikişli)', price: 475500 },
      { treatment_name: 'Alveol Plastiği (Yarım Çene)', price: 1039500 },
      { treatment_name: 'Alveol Düzeltilmesi (Yarım Çene)', price: 1039500 },
      { treatment_name: 'Kist Operasyonu (Küçük)', price: 1105500 },
      { treatment_name: 'Kist Operasyonu (1 Cm Büyük)', price: 1650000 },
      { treatment_name: 'Epulis Operasyonu', price: 715000 },
      { treatment_name: 'Osteomyelitis veya Osteitis Operasyonu (Tek Çene Basit)', price: 1925000 },
      { treatment_name: 'Çene Lüksasyonu', price: 379500 },
      { treatment_name: 'Vestibüloplasti (Yarım Çene)', price: 2090000 },
      { treatment_name: 'Sinüs Plastiği', price: 1265000 },
      { treatment_name: 'Sert Doku Greftleme (Greft Ücreti Hariç)', price: 1595000 },
      { treatment_name: 'Yumuşak Doku Greftleme (Greft Ücreti Hariç)', price: 1320000 },
      { treatment_name: 'Sinüs Lifting (Biomateryal Ücreti Hariç)', price: 1446500 },
      { treatment_name: 'Biyopsi', price: 638000 },
      { treatment_name: 'Fibrom Operasyonu', price: 664500 },
      { treatment_name: 'Apse Drenajı ve Tedavisi (Extraoral)', price: 1116500 },
      { treatment_name: 'Apse Drenajı ve Tedavisi (İntraoral)', price: 879000 },
      { treatment_name: 'Kapişon İzalesi - İmplant Üstü Açılması', price: 364000 },
      { treatment_name: 'Stomatit Tedavisi', price: 239500 },
      { treatment_name: 'Fizik Tedavi (İnfraruj Seansı)', price: 210500 },
      { treatment_name: 'Çene Kırığı (Basit)', price: 2255000 },
      { treatment_name: 'Çene Kırığı (Komplike - Materyal Ücreti Hariç)', price: 6380000 },
      { treatment_name: 'Reimplantasyon', price: 1155000 },
      { treatment_name: 'Ototransplantasyon', price: 1705000 },
      { treatment_name: 'Kemik İçi İmplant (Tek Silindirik İmplant Ücreti Hariç)', price: 2244000 },
      { treatment_name: 'Torus Operasyonu (Yarım Çene)', price: 1078000 },
      { treatment_name: 'Odontogenik Tümör Operasyonu (Küçük)', price: 2035000 },
      { treatment_name: 'Odontogenik Tümör Operasyonu (Büyük)', price: 2695000 },
      { treatment_name: 'Nevralji Tedavisi (Alkol Enjeksiyonu)', price: 385000 },
      { treatment_name: 'Nevralji Tedavisi Cerrahi (Nöroktomi vb.)', price: 1045000 },
      { treatment_name: 'Tükürük Bezi Kanalından Taş Çıkarma (Basit)', price: 797500 },
      { treatment_name: 'Tükürük Bezi Kanalından Taş Çıkarma (Komplike)', price: 1265000 },
      { treatment_name: 'Ortodontik Tedavi Amaçlı Gömük Dişlerin Üzerinin Açılması', price: 1045000 },
      { treatment_name: 'T.M.E. Mekonoterapi', price: 357500 },
      { treatment_name: 'T.M.E. İçi Enjeksiyon (Tek Taraflı)', price: 715000 },
      { treatment_name: 'Artrosentez (Tek Taraflı)', price: 491500 },
      { treatment_name: 'Açık Eklem Cerrahisi (Tek Taraflı)', price: 8250000 },
      { treatment_name: 'Genioplasti', price: 8250000 },
      { treatment_name: 'Segmental Osteotomi', price: 8800000 },
      { treatment_name: 'Osteotomi (Tek Çene)', price: 9240000 },
      { treatment_name: 'Dişhekimliğinde Botulinum Toksin Uygulaması', price: 1155000 },
      { treatment_name: 'İmplant Çıkartılması', price: 1045000 },
      { treatment_name: 'Ankraj Amaçlı Plak Yerleştirme (Malzeme Ücreti Hariç)', price: 1122000 },
      { treatment_name: 'Ankraj Amaçlı Plak Çıkarma', price: 660000 },
      { treatment_name: 'Zigoma İmplant (İmplant Ücreti Hariç)', price: 4950000 },
      { treatment_name: 'Koronektomi', price: 1045000 },
    ],
  },
  {
    category: 'Periodontoloji',
    items: [
      { treatment_name: 'Detartraj (Diş Taşı Temizliği - Tek Çene)', price: 330000 },
      { treatment_name: 'Subgingival Küretaj (Tek Diş)', price: 187000 },
      { treatment_name: 'Subgingival İlaç Uygulaması', price: 33000 },
      { treatment_name: 'Gingivoplasti (Tek Diş)', price: 313500 },
      { treatment_name: 'Gingivektomi (Tek Diş)', price: 324500 },
      { treatment_name: 'Flap Operasyonu (Subgingival Küretaj Dahil - Tek Diş)', price: 522500 },
      { treatment_name: 'Tunnel Operasyonu (Tek Diş)', price: 444500 },
      { treatment_name: 'Hemiseksiyon (Kök Amputasyonu - Kanal Tedavisi Hariç)', price: 384500 },
      { treatment_name: 'Serbest Diş Eti Grefti (Tek Diş)', price: 538000 },
      { treatment_name: 'Saplı Yumuşak Doku Grefti (Koronale Kaydırma, Yana Kaydırma, Tek Diş)', price: 425000 },
      { treatment_name: 'Periodontal Splint (Daimi)', price: 637000 },
      { treatment_name: 'Periodontal Splint (Geçici)', price: 807000 },
      { treatment_name: 'Periodontal Şine (Splint - Geçici - Yarım Çene)', price: 369000 },
      { treatment_name: 'Biyomateryal Uygulaması (Tek Diş - Flap Op. ve Biomateryal Ücreti Hariç)', price: 137500 },
      { treatment_name: 'Membran Uygulaması (Tek Diş - Flap Op. ve Membran Ücreti Hariç)', price: 136000 },
      { treatment_name: 'Vestibül Plak (Diş Eti Protezi - Çene Başına)', price: 902000 },
      { treatment_name: 'Subepitelyal Bağ Dokusu Grefti', price: 1485000 },
      { treatment_name: 'Frenektomi - Frenetomi', price: 770000 },
      { treatment_name: 'Peri-İmplantitis (Cerrahi) (Biomaterial ve Membran Ücreti Hariç) (Tek İmp.)', price: 687500 },
      { treatment_name: 'Peri-İmplantitis (Cerrahi Olmayan) (Tek İmp.)', price: 118500 },
      { treatment_name: 'Papil Oluşturma (Cerrahi) (Tek Papil)', price: 291000 },
      { treatment_name: 'Papil Oluşturma (Cerrahi Olmayan) (Tek Papil)', price: 288500 },
      { treatment_name: 'Fiberotomi', price: 275000 },
    ],
  },
  {
    category: 'Ortodonti',
    items: [
      { treatment_name: 'Lateral Sefalometrik Film Analizi', price: 167500 },
      { treatment_name: 'Antero Posterior Sefalometrik Film Analizi (Frontal Film Analizi)', price: 187000 },
      { treatment_name: 'Kemik Yaşı Tayini', price: 64500 },
      { treatment_name: 'Ortodontik Fotoğraf', price: 99000 },
      { treatment_name: 'Ortodontik Fotoğraf Tetkiki', price: 60500 },
      { treatment_name: 'Ortodontik Model Yapımı', price: 121000 },
      { treatment_name: 'Ortodontik Model Analizi', price: 148000 },
      { treatment_name: 'Ara Dönem Sefalometrik Film Analizi', price: 99000 },
      { treatment_name: 'Ara Dönem Model Yapımı', price: 187500 },
      { treatment_name: 'Angle Sınıf I Anomalilerinin Ortodontik Tedavisi', price: 4091000 },
      { treatment_name: 'Angle Sınıf II Anomalilerinin Ortodontik Tedavisi', price: 5139500 },
      { treatment_name: 'Angle Sınıf III Anomalilerinin Ortodontik Tedavisi', price: 6267500 },
      { treatment_name: 'Sabit Kapanış Yükseltici Tatbiki (Kısa Süreli)', price: 341000 },
      { treatment_name: 'Lingual Teknikle Angle Sınıf I Anomalilerinin Ortodontik Tedavisi', price: 4196500 },
      { treatment_name: 'Lingual Teknikle Angle Sınıf II Anomalilerinin Ortodontik Tedavisi', price: 4840000 },
      { treatment_name: 'Lingual Teknikle Angle Sınıf III Anomalilerinin Ortodontik Tedavisi', price: 5720000 },
      { treatment_name: 'Açık Kapanışın Ortodontik Tedavisi', price: 6103000 },
      { treatment_name: 'Önleyici Ortodontik Tedavi', price: 2612500 },
      { treatment_name: 'Kısa Süreli Ortodontik Tedavi', price: 2329000 },
      { treatment_name: 'Pekiştirme Tedavisi', price: 929500 },
      { treatment_name: 'Pekiştirme Aygıtı (Hawley Aygıtı vb.)', price: 676500 },
      { treatment_name: 'Sabit Pekiştirme Aygıtı (Lingual Retainer)', price: 962500 },
      { treatment_name: 'Dudak Yastıkçığı (Lip Bumper)', price: 1072500 },
      { treatment_name: 'Tek Çeneyi İlgilendiren Aparey Yapımı (Vida Hariç)', price: 753500 },
      { treatment_name: 'Çift Çeneyi İlgilendiren Aparey Yapımı (Frankel Aygıtları - Aktivatör - Bionatör)', price: 1226500 },
      { treatment_name: 'Vida Uygulaması (Tek Vida)', price: 196500 },
      { treatment_name: 'Sabit Fonksiyonel Aygıt Uygulaması (Jasper - Jumper - Herbest Aygıtı)', price: 2090000 },
      { treatment_name: 'Kayıp Apareyin Yeniden Yapımı (Tek Çene)', price: 643500 },
      { treatment_name: 'Aparey Tamiri', price: 302500 },
      { treatment_name: 'Ağız Dışı Aparey Tatbiki (Headgear - Chincap)', price: 687500 },
      { treatment_name: 'Reverse Headgear', price: 1963500 },
      { treatment_name: 'Düz Ark Teli Tatbiki (Tek Çene NİTİ Telleri)', price: 225500 },
      { treatment_name: 'Büküm İçeren Tel Tatbiki (Tek Çene)', price: 247500 },
      { treatment_name: 'Segmental Ark veya Tork Arkı Tatbiki', price: 209000 },
      { treatment_name: 'Bant Tatbiki (Tek Diş)', price: 225500 },
      { treatment_name: 'Braket Tatbiki (Tek Diş)', price: 192500 },
      { treatment_name: 'Lingual Braket Tatbiki (Tek Diş)', price: 192500 },
      { treatment_name: 'Düşen Bant Tatbiki (Tek Diş)', price: 225500 },
      { treatment_name: 'Düşen Braket Tatbiki (Tek Diş)', price: 192500 },
      { treatment_name: 'Bant veya Braket Çıkarılması (Tek Diş)', price: 78500 },
      { treatment_name: 'Lingual Ataçman Tatbiki', price: 209000 },
      { treatment_name: 'Lingual Ark', price: 742500 },
      { treatment_name: 'Nance Apareyi', price: 1127500 },
      { treatment_name: 'Hızlı Maksiller Genişletme Apareyi', price: 1375000 },
      { treatment_name: 'Preoperatif Dudak Damak Yarığı (Ortodontik Tedavi)', price: 3355000 },
      { treatment_name: 'Postoperatif Dudak Damak Yarığı (Ortodontik Tedavi)', price: 1402500 },
      { treatment_name: 'T.M.E. Splint Yapımı', price: 1369500 },
      { treatment_name: 'Model Set-Up', price: 643500 },
      { treatment_name: 'Positioner Yapımı', price: 1512500 },
      { treatment_name: 'Sefalometrik Cerrahi Planı', price: 335500 },
      { treatment_name: 'Ortodontik Modellerin Face - Bow ile Artikülatöre Taşınması', price: 715000 },
      { treatment_name: 'Model Cerrahisi', price: 407000 },
      { treatment_name: 'Oklüzal Cerrahi Splint (Tek Çene)', price: 1215000 },
      { treatment_name: 'Ortodontik Ameliyat Arkı (Tek Çene)', price: 2108000 },
      { treatment_name: 'Sürme Rehberliği', price: 1776500 },
      { treatment_name: 'Ağız İçi Distalizasyon Apareyi (Pendex vb.)', price: 1589500 },
      { treatment_name: 'Gömülü Dişin Diş Dizisinde Yerine Yerleştirilmesi (Tek Diş)', price: 2106500 },
      { treatment_name: "Reserve Curve'li Niti Ark Tatbiki", price: 357500 },
      { treatment_name: 'Ortognatik Cerrahi Ortodontik Tedavisi', price: 6948000 },
      { treatment_name: 'Mini Vida Uygulaması', price: 495000 },
      { treatment_name: 'İnterproksimal Aşındırma (Tek Diş)', price: 126500 },
      { treatment_name: 'Şeffaf Plaklar ile Ortodontik Tedavi (Hafif) (Plak Ücreti Hariç)', price: 5390000 },
      { treatment_name: 'Şeffaf Plaklar ile Ortodontik Tedavi (Orta) (Plak Ücreti Hariç)', price: 6930000 },
      { treatment_name: 'Şeffaf Plaklar ile Ortodontik Tedavi (Ağır) (Plak Ücreti Hariç)', price: 9570000 },
      { treatment_name: 'Ağız İçi Koruyucu Aparey', price: 1100000 },
    ],
  },
]

// TDB_CURRENT_YEAR: her yeni TDB tarifesi yayınlandığında bu sabiti ve TDB_2026 verisini güncelle
const TDB_CURRENT_YEAR = 2026

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

  const rows = TDB_2026.flatMap(({ category, items }) =>
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
  if (prof.tdb_year !== TDB_CURRENT_YEAR) return { error: `Bu profil TDB ${prof.tdb_year} tarifesine ait; güncel tarife için TDB ${TDB_CURRENT_YEAR} profilini içe aktarın.` }

  // Atomik upsert (sync_tdb_tariffs RPC): mevcut kalemler yerinde güncellenir, tedavi/plan bağlantıları korunur
  const items = TDB_2026.flatMap(({ category, items }) =>
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

// ---- TDB tarifesini Excel/CSV dosyasından içe aktar ----
// Dosya tarayıcıda çözümlenir (tdbParse.ts); buraya yalnızca doğrulanmış kalemler gelir. Fiyatlar kuruş, KDV dahil.
export async function importTdbFromRows(
  year: number,
  items: { category: string; treatment_name: string; price: number }[]
): Promise<{ success?: boolean; error?: string; count?: number; updated?: boolean }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const adminErr = requireAdmin(ctx)
  if (adminErr) return { error: adminErr.error }
  const { supabase, clinicId } = ctx

  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Geçerli bir yıl girin' }
  if (!Array.isArray(items) || items.length === 0) return { error: 'İçe aktarılacak kalem yok' }
  if (items.length > 3000) return { error: 'Bir seferde en fazla 3000 kalem aktarılabilir' }
  const clean: { category: string; treatment_name: string; price: number; currency: string }[] = []
  for (const it of items) {
    const name = String(it?.treatment_name ?? '').trim()
    const category = String(it?.category ?? '').trim() || 'Diğer'
    const price = Number(it?.price)
    if (!name || name.length > 200 || category.length > 120) return { error: 'Geçersiz kalem adı veya kategori bulundu' }
    if (!Number.isInteger(price) || price <= 0 || price > 100_000_000_00) return { error: `"${name}" için geçersiz fiyat` }
    clean.push({ category, treatment_name: name, price, currency: 'TRY' })
  }

  let profileId: number
  let updated = false
  const { data: existing } = await supabase
    .from('tariff_profiles')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('source', 'tdb')
    .eq('tdb_year', year)
    .maybeSingle()
  if (existing) {
    profileId = existing.id
    updated = true
  } else {
    const { data: created, error: createErr } = await supabase
      .from('tariff_profiles')
      .insert({ clinic_id: clinicId, name: `TDB ${year}`, source: 'tdb', tdb_year: year, last_synced_at: new Date().toISOString() })
      .select('id')
      .single()
    if (createErr || !created) return { error: createErr?.message ?? 'Profil oluşturulamadı' }
    profileId = created.id
  }

  const { error } = await supabase.rpc('sync_tdb_tariffs', { p_profile_id: profileId, p_clinic_id: clinicId, p_items: clean })
  if (error) {
    if (!updated) await supabase.from('tariff_profiles').delete().eq('id', profileId).eq('clinic_id', clinicId)
    return { error: error.message }
  }
  await supabase.from('tariff_profiles').update({ last_synced_at: new Date().toISOString() }).eq('id', profileId).eq('clinic_id', clinicId)
  revalidatePath('/settings')
  return { success: true, count: clean.length, updated }
}
