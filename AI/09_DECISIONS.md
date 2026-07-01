# DentSoft — Mimari Kararlar

## DECISION-001: Monolitik PatientsClient → Ayrı Sekme Bileşenleri
**Tarih:** 2026-06-26  
**Karar:** Hasta sekmelerini ayrı dosyalara çıkar  
**Neden:** ~3000 satırlık monolitik dosya HMR/Fast Refresh donmalarına yol açıyordu  
**Sonuç:** Her sekme ayrı dosya; `types.ts`, `constants.ts`, `formatters.ts` paylaşılan yardımcılar  
**Durum:** ✅ Uygulandı

---

## DECISION-002: Para Birimi — Kuruş (INTEGER)
**Tarih:** İlk tasarım  
**Karar:** Tüm para değerleri veritabanında INTEGER (kuruş) olarak saklanır  
**Neden:** Float virgül kayması sorunlarını önler; TL = kuruş / 100  
**Etkilenen alanlar:** `fee`, `amount`, `monthly_salary`, `price`, `vat_rate` (bps)  
**Durum:** ✅ Aktif kural — yeni alanlar da bu kurala uymalı

---

## DECISION-003: Soft Delete (Hastalar)
**Tarih:** 2026-06-27  
**Karar:** Hasta silme işlemi `status='passive'` olarak işaretler, fiziksel silme yapmaz  
**Neden:** KVKK — hasta verisi silinemez; aynı zamanda veri bütünlüğü  
**Durum:** ✅ Aktif kural

---

## DECISION-004: Multi-tenant Mimari
**Tarih:** İlk tasarım  
**Karar:** Tüm tablolarda `clinic_id` sütunu; RLS politikaları klinik izolasyonunu garantiler  
**Neden:** SaaS hedefi — birden fazla klinik aynı veritabanında  
**Provision:** `provision_clinic()` fonksiyonu ile yeni klinik oluşturulur  
**Durum:** ✅ Aktif — yeni tablolar `clinic_id` içermeli, RLS politikası eklenmelidir

---

## DECISION-005: Şifreleme (TC + Anamnez)
**Tarih:** İlk tasarım  
**Karar:** TC kimlik ve anamnez verileri uygulama katmanında AES-256-GCM ile şifrelenir  
**Neden:** KVKK — kişisel sağlık verisi Supabase'e düz metin geçemez  
**Alanlar:** `tc_enc`, `anamnesis_enc`  
**Anahtar:** `.env.local` → `ENCRYPTION_KEY` (asla kodda sabit)  
**Durum:** ✅ Aktif kural

---

## DECISION-006: Server Actions (Tüm Mutasyonlar)
**Tarih:** İlk tasarım  
**Karar:** Tüm veri mutasyonları Next.js Server Actions üzerinden yapılır  
**Neden:** `service_role` anahtarı istemci tarafına açılmaz; RLS bypass güvenli sunucu kodunda  
**Durum:** ✅ Aktif kural

---

## DECISION-007: Toast + ConfirmModal (UX Standartı)
**Tarih:** 2026-06-27  
**Karar:** `alert()`, `confirm()`, `prompt()` (native browser API) kullanılmaz  
**Standart:** Hata bildirimleri → `toast.error()` (sonner), onay diyalogları → `useConfirm()` (ConfirmModal.tsx)  
**İstisna:** `window.confirm()` yalnızca form submit önleme gereken yerlerde kabul edilir (TarifeTab profil sil/sıfırla)  
**Durum:** ✅ Aktif kural

---

## DECISION-008: KDV Oranı — Ayardan Dinamik
**Tarih:** 2026-06-28  
**Karar:** KDV oranı `clinic_settings.vat_rate` (bps) alanından okunur; kodda sabit değer yok  
**Varsayılan:** 2000 bps = %20 (kod: `clinic?.vat_rate ?? 2000`)  
**Ayarlar:** Ayarlar → Klinik sekmesindeki "KDV Oranı (%)" alanından değiştirilebilir  
**Durum:** ✅ Aktif

---

## DECISION-009: Migration Politikası
**Tarih:** İlk tasarım  
**Karar:** Migration'lar SADECE ekleyici/değiştirici (CREATE, ALTER ADD COLUMN)  
**Kural:** DROP TABLE, DELETE, TRUNCATE içeren migration asla otomatik çalıştırılmaz — Furkan onayı gerekli  
**Neden:** Gerçek hasta verisi kayıp riski  
**Durum:** ✅ Aktif kural

---

## DECISION-010: Görev Bazlı AI Dokümantasyonu
**Tarih:** 2026-06-29  
**Karar:** Yeni oturumda yalnızca başlangıç yönlendirmesi ve güncel bağlam okunur; diğer belgeler görev türüne göre seçilir.  
**Neden:** Her görevde tüm geçmiş ve referans belgelerini okumak context boyutunu, token tüketimini ve yanıt süresini gereksiz artırıyordu.  
**Uygulama:** Belge yönlendirmesi `00_START_HERE.md`, canlı durum `01_CURRENT_CONTEXT.md`, eski oturumlar `archive/` altında tutulur.  
**Güncelleme:** Küçük görevlerde belge güncellemesi zorunlu değildir; yalnızca güncelleme matrisi uygulanır.  
**Durum:** ✅ Aktif kural
