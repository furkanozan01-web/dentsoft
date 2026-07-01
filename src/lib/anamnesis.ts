// Anamnez (sağlık geçmişi) sabitleri — şartname §8 / §4.3.2 tam liste.
// İstemci + sunucu tarafında kullanılabilir (saf veri, 'server-only' DEĞİL).
// Sağlık verisi DB'ye anamnesis_enc içinde ŞİFRELİ yazılır; bu dosya sadece
// görüntüleme/uyarı mantığını tutar.

export type WarningLevel = 'red' | 'orange' | 'yellow'

export interface DiseaseDef {
  key: string
  warning: string
  level: WarningLevel
}

// Şartname §8 tam liste (12 hastalık). Seviyeler §4.3.2'de açıkça verilenler
// birebir; verilmeyenler diş hekimliği aciliyetine göre makul atandı.
export const DISEASES: DiseaseDef[] = [
  { key: 'Diyabet', warning: 'Yara iyileşmesi gecikebilir.', level: 'red' },
  { key: 'Hipertansiyon', warning: 'Anestezide epinefrin dozu ayarlanmalı.', level: 'orange' },
  { key: 'Kalp Hastalığı', warning: 'Endokardit profilaksisi gerekebilir.', level: 'red' },
  { key: 'Alerji', warning: 'Alerjik reaksiyon riski değerlendirilmeli.', level: 'yellow' },
  { key: 'Astım', warning: 'NSAİİ astım krizi tetikleyebilir.', level: 'orange' },
  { key: 'Kanama Bozukluğu', warning: 'İşlem öncesi kanama profili alınmalı.', level: 'red' },
  { key: 'Hepatit', warning: 'Çapraz enfeksiyon kontrolü uygulanmalı.', level: 'orange' },
  { key: 'HIV', warning: 'Enfeksiyon kontrol protokolü uygulanmalı.', level: 'orange' },
  { key: 'Tiroid', warning: 'İlaç etkileşimi riski değerlendirilmeli.', level: 'yellow' },
  { key: 'Böbrek Yetmezliği', warning: 'İlaç dozu ayarı gerekebilir.', level: 'orange' },
  { key: 'Hamilelik', warning: 'Radyografi ve belirli ilaçlardan kaçının.', level: 'red' },
  { key: 'Nörolojik', warning: 'Konfor önlemleri alınmalı.', level: 'yellow' },
]

export interface DrugInteraction {
  drugs: string[]
  risk: string
  level: WarningLevel
}

// Şartname §8 — MVP listesi. İleride İlaç Tablosu.zip ile genişletilecek.
export const DRUG_INTERACTIONS: DrugInteraction[] = [
  { drugs: ['Aspirin', 'Varfarin'], risk: 'Kanama riski artmış.', level: 'red' },
  { drugs: ['Varfarin', 'Antibiyotik'], risk: 'INR değişimi riski.', level: 'orange' },
  { drugs: ['Metformin', 'Kortizon'], risk: 'Kan şekeri yükselebilir.', level: 'orange' },
  { drugs: ['Kortizon', 'İnsülin'], risk: 'Doz ayarı gerekli.', level: 'yellow' },
]

// MVP ilaç listesi (Smyle mockup'taki drugDatabase). İleride İlaç Tablosu.zip ile
// genişletilecek. Hasta Kartı'nda ilaç eklerken öneri olarak kullanılır.
export interface DrugDef {
  name: string
  type: string
}

export const DRUG_DATABASE: DrugDef[] = [
  { name: 'Aspirin', type: 'Antiagregan' },
  { name: 'Varfarin', type: 'Antikoagülan' },
  { name: 'Metformin', type: 'Oral Antidiyabetik' },
  { name: 'İnsülin', type: 'Hormon' },
  { name: 'Kortizon', type: 'Kortikosteroid' },
  { name: 'Bifosfonat', type: 'Kemik Rezorpsiyon İnhibitörü' },
  { name: 'Antidepresan', type: 'Psikiyatrik' },
  { name: 'Antibiyotik', type: 'Antimikrobiyal' },
]

// Hastanın ilaç listesine göre etkin etkileşimleri döner (substring eşleşme).
export function checkInteractions(medications: string[]): DrugInteraction[] {
  return DRUG_INTERACTIONS.filter((interaction) =>
    interaction.drugs.every((drug) =>
      medications.some((m) => m.toLowerCase().includes(drug.toLowerCase()))
    )
  )
}

// Şifrelenip anamnesis_enc'e yazılan / oradan çözülen yapı.
export interface Anamnesis {
  diseases: string[] // DISEASES[].key listesi
  medications: string[] // serbest metin ilaç adları
  notes: string // serbest klinik not
}

export const EMPTY_ANAMNESIS: Anamnesis = {
  diseases: [],
  medications: [],
  notes: '',
}

export const LEVEL_STYLES: Record<WarningLevel, { dot: string; box: string; text: string }> = {
  red: { dot: 'bg-red-500', box: 'bg-red-50 border-red-100', text: 'text-red-700' },
  orange: { dot: 'bg-orange-500', box: 'bg-orange-50 border-orange-100', text: 'text-orange-700' },
  yellow: { dot: 'bg-yellow-400', box: 'bg-yellow-50 border-yellow-100', text: 'text-yellow-700' },
}
