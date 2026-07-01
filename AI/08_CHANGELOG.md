# DentSoft — Değişiklik Günlüğü

En yeni değişiklik en üstte yer alır.

---

## 2026-06-29 - AI Dokümantasyon Optimizasyonu

- Varsayılan belge okuma modeli tüm dosyalar yerine görev bazlı seçmeli okumaya geçirildi.
- `../CLAUDE.md` ve `00_START_HERE.md` kısa yönlendirme dosyalarına dönüştürüldü.
- Güncel bağlam, AI güvenlik kuralları, kod standartları, mimari referans ve yol haritası ayrıştırıldı.
- Eski oturum kayıtları `AI/archive/11_SESSION_LOG_2026-06.md` altında korundu.
- Uygulama kodu, veritabanı ve çalışma ayarları değiştirilmedi.

---

## 2026-06-29 — Hasta Kartı Geliştirmeleri (Claude Code)
- **Hasta Arama**: Hasta Kartı sekmesinin en üstüne arama çubuğu eklendi — isim, telefon veya protokol no ile tüm hasta listesinde anlık arama; dropdown'dan seçince hasta kartı güncellenir
- **Yazdır**: Hasta kartı başlığına "Yazdır" butonu eklendi; yeni pencerede HTML tabanlı print sayfası oluşturur (kişisel bilgiler, bakiye, anamnez)
- **Harici Sistemler**: Yeni kart — e-Rapor, e-Nabız, Reçetem linkleri (yeni sekmede açılır)
- **İletişim & Onay**: Yeni kart — SMS (sms: protokol), WhatsApp (wa.me, TR telefon biçimlendirmesi), KVKK Onamı modal (şablon + SMS gönder), Dijital Onam modal (şablon + SMS gönder)
- TypeScript: 0 hata doğrulandı

---

## 2026-06-28 — Türkçe Karakter Düzeltmesi + Takip Sekmesi (Claude Code)

### Türkçe Karakter Düzeltmesi
- `src/app/settings/constants.ts` tüm ASCII bozuklukları düzeltildi:
  - SPECIALTIES: `'Diger'` → `'Diğer'`
  - DAYS: `'Sali'` → `'Salı'`, `'Carsamba'` → `'Çarşamba'`, `'Persembe'` → `'Perşembe'`
  - PAYMENT_MODELS: `'Sabit Maas'` → `'Sabit Maaş'`, `'Aylik sabit tutar'` → `'Aylık sabit tutar'`, `'Ciro uzerinden yuzde'` → `'Ciro üzerinden yüzde'`, `'Maas + komisyon'` → `'Maaş + komisyon'`
  - PAYMENT_MODEL_LABEL: `'Sabit Maas'` → `'Sabit Maaş'`
  - ROLE_LABEL: `'Bashekim / Admin'` → `'Başhekim / Admin'`, `'Dis Hekimi'` → `'Diş Hekimi'`, `'Goruntuleyici'` → `'Görüntüleyici'`, `'Kullanici'` → `'Kullanıcı'`
  - ASSIGNABLE_ROLES: aynı düzeltmeler

### Takip Sekmesi (ADIM 1-4 tamamlandı)
- **Migration** `supabase/migrations/20260628_followup_tables.sql`: 3 yeni tablo + RLS + indeksler
  - `followup_templates`: klinik şablonları
  - `treatment_followups`: hastaya bağlı takip planları
  - `followup_steps`: her planın adımları (ON DELETE CASCADE)
  - Supabase'e uygulandı — 3 tablo doğrulandı
- **Server Actions** `src/app/patients/followup-actions.ts`: `createFollowup`, `updateFollowupStep`, `deleteFollowup`, `getFollowupsForPatient`, `getUpcomingFollowupSteps`
- **UI** `src/app/patients/PatientFollowupTab.tsx`: timeline kart görünümü, şablon seçici (4 hazır şablon), "+ Yeni Takip" modal, adım tamamlama toggle, progress bar, sil butonu
- **Entegrasyon**: `types.ts` → `FollowupStep` + `Followup` interface, `TabId` → `'takip'` eklendi; `constants.ts` → `{ id: 'takip', label: 'Takip' }` eklendi; `PatientsClient.tsx` → TakipTab import + render
- **Dashboard** `src/app/page.tsx`: önümüzdeki 7 günde tamamlanmamış takip adımları için "Dikkat" paneli girişi eklendi
- TypeScript: 0 hata doğrulandı

---

## 2026-06-28 — Codex Kapsamlı Kod İncelemesi (Claude Code)
- Tüm Codex değişiklikleri (hasta sekme bileşenleri, ayarlar, randevu, finans, dashboard) gözden geçirildi
- **Hata düzeltmesi:** `src/app/patients/constants.ts` sekme etiketleri ASCII'den Türkçeye düzeltildi:
  - `'Hasta Karti'` → `'Hasta Kartı'`
  - `'Not & Goruntu'` → `'Not & Görüntü'`
  - `'Recete'` → `'Reçete'`
- `localDateValue` import'u `PatientModals.tsx` ve `PatientAccountTab.tsx` içinde doğrulandı (fonksiyon mevcut)
- TypeScript: 0 hata doğrulandı
- `alert()` / `prompt()` / naked `confirm()` kalmadı — iki `window.confirm()` TarifeTab istisnası korundu (DECISION-007)
- Güvenlik: `service_role` anahtarı istemci kodunda yok, şifreleme akışı sağlam

---

## 2026-06-28 — AI Dokümantasyon Sistemi Kurulumu (Claude Code)
- `AI/00_START_HERE.md` oluşturuldu (başlangıç kılavuzu)
- `AI/01_PROJECT_OVERVIEW.md` oluşturuldu (proje genel bakış)
- `AI/03_PROJECT_REPORT.md` oluşturuldu (güncel modül durumu)
- `AI/08_CHANGELOG.md` oluşturuldu (bu dosya)
- `AI/09_DECISIONS.md` oluşturuldu (mimari kararlar)
- `AI/11_SESSION_LOG.md` referans verilen dosyaların kayıp olduğu tespit edildi, yapı düzeltildi

---

## 2026-06-29 — Önemli Klinik Not Hatırlatması (Codex)
- Klinik notlara kalıcı “Önemli” işareti ve kırmızı ünlem görünümü eklendi.
- Hasta detay ekranı açıldığında susturulmamış önemli notları gösteren hatırlatma paneli eklendi.
- “Bir Daha Gösterme” seçimi mevcut önemli notları kalıcı olarak susturuyor; not yeniden önemli yapılırsa hatırlatma yeniden etkinleşiyor.
- Hızlı hasta geçişlerinde eski veri isteğinin yanlış hastaya ait hatırlatma açması engellendi.
- Migration: `20260629050000_clinical_note_importance.sql`, `20260629051000_clinical_notes_patient_lookup_index.sql`

## 2026-06-29 — Tedavi Geçmişi Hesap ve Döküm Özellikleri (Codex)
- `treatments` tablosuna `original_fee` ve `is_closed` alanları eklendi; mevcut kayıtlar geriye dönük dolduruldu.
- Açık tedaviler için hesap kapatma ve ilk fiyatı temel alan orantısal yüzde/sabit tutar ayarlaması eklendi.
- Tedavi Geçmişi'ne kapalı kayıt görünümü, `KPL` durumu, canlı ayarlama önizlemesi ve ilk/net fiyat gösterimi eklendi.
- Oral ve Hesap sekmeleri aynı A4 tedavi dökümünü kullanıyor; klinik/hasta bilgisi, diş şeması, tedaviler, ödeme özeti ve imza alanları içeriyor.
- Migration: `20260629_treatment_account_adjustments.sql`

## 2026-06-28 — Gözden Geçirme Turu (Claude Code)
**Bölüm 5B + 6C + Genel Temizlik**
- Randevu durum değişiminde takvim kartı optimistik renk güncellemesi (5B)
- Hasta sayfasına Breadcrumb navigasyonu eklendi (6C): "Hastalar > Hasta Adı"
- KDV oranı Ayarlar → Klinik sekmesine % alanı olarak eklendi; `updateClinic` action güncellendi
- `alert()` / raw `confirm()` / `prompt()` tümüyle `toast.error()` + `useConfirm()` ile değiştirildi:
  - `AppointmentsClient.tsx`: PendingRow, NewAppointmentModal
  - `PatientsClient.tsx` (eski monolitik): OralTab handleAdd, PrintInvoice, ReceteTab (tüm hata yolları)
  - `FinanceClient.tsx`: DoctorPaymentModal hata yolu
  - `SettingsClient.tsx`: TarifeTab handleToggle/handlePriceSave/handleDurationSave/handleDeleteItem
- Otomatik taksit `prompt()` → inline sayı giriş kutusu (state tabanlı)
- tsc 0 hata doğrulandı

---

## 2026-06-28 — Bölüm 5: Randevu Detay Paneli (Claude Code)
- `appointments/actions.ts`: `updateAppointment()` action eklendi (hekim/tarih/süre/not + çakışma kontrolü)
- `AppointmentsClient.tsx`: `ManageModal` tamamen yeniden yazıldı:
  - Hasta adı tıklanabilir link → `/patients?patient_id=X`
  - Durum değiştirme butonları (mevcut duruma göre filtrelenir)
  - "Tedaviye Dönüştür" butonu → `/patients?patient_id=X&tab=oral`
  - "Düzenle" modu: hekim/tarih/saat/süre/not formu
  - "Sil": ConfirmModal + toast
- `Appointment` interface'ine `patient_id`, `doctor_id` eklendi

---

## 2026-06-27 — Bölüm 4: Finans Güçlendirme (Claude Code)
- `finance/actions.ts`: `addExpense` genişletildi (kategori/fatura no/tekrar)
- `FinanceClient.tsx` komple güncellendi:
  - Bakiye: 3 özet kart, aging badge, "Ödeme Al" butonu
  - Hakediş: ödeme modeli farkındalıklı kartlar (komisyon/maaş/karma/tanımsız)
  - Defter: gider kategori badge, gelir hasta adı tıklanabilir
  - Bilgi: özel tooltip (Bilgi+Gelir+Gider+Net)
- Migration: `transactions_add_category_recurring`

---

## 2026-06-27 — Bölüm 3: Ayarlar Kullanıcı Sekmesi (Claude Code)
- Rol yönetimi inline, Son Giriş sütunu, Pasif Yap/Aktif Yap
- İzin tablosu (PermissionTable)
- Davet modalı: full_name + hekim ilişkisi
- Migration: `profiles_allowlist_doctor_link`

---

## 2026-06-27 — Bölüm 2: Ayarlar Diş Hekimi Sekmesi (Claude Code)
- DoctorEditor inline panel: Kişisel Bilgiler, Hakediş Modeli, Çalışma Saatleri
- `updateDoctor()` action eklendi
- `formatCurrency()` boşluk hatası düzeltildi (₺ bitişik)
- Migration: `doctors_add_payment_model_fields`

---

## 2026-06-27 — Bölüm 1: Genel CRUD (Claude Code)
- Hasta düzenle/sil (soft delete), Anamnez toast, Tedavi silme+ücret düzenleme
- Ödeme silme, Not düzenleme/silme
- `ConfirmModal.tsx` (useConfirm hook) oluşturuldu
- `format.ts` (formatCurrency, formatAmount, parseToKurus) oluşturuldu
- `sonner` Toaster layout.tsx'e eklendi

---

## 2026-06-26 — UI Modernizasyon Turu (Codex)
- Ana sayfa KPI kartları: kodlanmış SVG/gradient, PNG kaldırıldı
- Dashboard alt bölüm kartları yenilendi
- Randevu takvimi görsel güncellemesi
- Hasta listesi → `PatientListTab.tsx`'e ayrıldı
- Hasta kartı → `PatientSummaryTab.tsx`'e ayrıldı
- Oral sekmesi → `PatientOralTab.tsx`'e ayrıldı, FDI şema görsel iyileştirme
- `types.ts`, `constants.ts`, `formatters.ts`, `helpers.ts` oluşturuldu

---

## 2026-06-25 — Fatura Ekranı (Codex)
- `PatientInvoiceTab.tsx` oluşturuldu
- KDV %10 (ayardan), fatura no/TC kimlik, gönderim kurumu, Gönder butonu
- `supabase/migrations/20260625_invoice_settings_and_payment_invoice_fields.sql`
- ISSUE-001 açıldı: harici e-fatura API entegrasyonu yok
