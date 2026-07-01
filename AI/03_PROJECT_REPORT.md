# DentSoft Proje Raporu

*Son güncelleme: 2026-06-29*

Bu belge yeni özellik ve modül durumu görevlerinde referans olarak okunur. Ayrıntılı geçmiş `08_CHANGELOG.md` dosyasındadır.

## Modül Durumu

| Modül | Durum | Not |
|---|---|---|
| Dashboard | Aktif | KPI, günlük randevu, son hastalar ve uyarılar |
| Hasta listesi ve kartı | Aktif | Arama, filtre, profil, anamnez ve hasta işlemleri |
| Oral ve tedavi | Geliştiriliyor | Diyagnoz, planlama, faz, hesap kapatma, ücret ayarlama ve A4 döküm |
| Hesap ve finans | Aktif | Ödeme, taksit, bakiye, gider ve hekim ödemeleri |
| Fatura | Kısmi | Sistem içi kayıt aktif, harici sağlayıcı entegrasyonu yok |
| Not, görüntü ve reçete | Aktif | Önemli not hatırlatması, klinik kayıt, private storage ve yazdırma |
| Takip | Aktif | Takip planları ve adımları eklendi |
| Randevu | Aktif | Gün/hafta görünümü, detay, durum, taşıma ve süre değiştirme |
| Ayarlar | Aktif | Klinik, hekim, kullanıcı, tarife ve randevu ayarları |
| PERİ | Kısmi | Araç altyapısı var, ürün akışları tamamlanmadı |

## Aktif Geliştirme

Oral tedavi planlarında çoklu planlama ve faz sekmeleri, kalem kopyalama ve sıralama bulunuyor. Tedavi Geçmişi açık/kapalı hesapları ayırıyor; ilk fiyat korunarak orantısal indirim/yuvarlama yapılabiliyor. Oral ve Hesap aynı A4 tedavi dökümünü kullanıyor. AI faz önerisi henüz uygulanmadı.

## Açık Konular

- Google OAuth allowlist güvenlik testi tamamlanmadı.
- Harici e-fatura/e-SMM entegrasyonu yok.
- Gerçek hasta verisi öncesi yedekleme ve operasyon hazırlığı gerekiyor.

Güncel öncelikler için `01_CURRENT_CONTEXT.md`, açık hata ayrıntıları için `12_KNOWN_ISSUES.md` okunur. Eski “tüm modüller tamamlandı” veya test sonucu ifadeleri kaynak kod doğrulanmadan varsayım kabul edilmemelidir.
