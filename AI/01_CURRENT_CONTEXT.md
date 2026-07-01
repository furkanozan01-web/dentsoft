# DentSoft Güncel Bağlam

*Son doğrulama: 2026-06-29*

## Aktif Mimari

DentSoft, Next.js 16 App Router ve React 19 üzerinde çalışan, Supabase PostgreSQL kullanan çok kiracılı bir klinik yönetim uygulamasıdır. Okumalar Server Component veya Supabase istemcisiyle, mutasyonlar ağırlıklı olarak Server Actions ile yapılır. Klinik izolasyonunun temeli `clinic_id` ve RLS politikalarıdır. Para alanları integer kuruş, oranlar gerektiğinde basis point olarak saklanır. T.C. kimlik ve anamnez alanları AES-256-GCM ile şifrelenir.

## Aktif Modüller

- Dashboard, randevu takvimi, finans ve ayarlar aktif.
- Hasta yönetiminde liste, hasta kartı, oral, hesap, fatura, not ve görüntü, reçete ve takip sekmeleri aktif.
- Oral bölümünde diyagnoz, planlama, faz ve tedavi akışları üzerinde çalışma bulunuyor.
- PERİ altyapısı mevcut ancak ürün özelliği olarak tamamlanmış değil.

## Güncel Çalışma Durumu

Oral Tedavi Geçmişi'ne açık/kapalı hesap ayrımı, orantısal ücret yuvarlama/indirim ve ortak A4 tedavi dökümü eklendi. `treatments.original_fee` ilk tarife ücretini, `treatments.is_closed` hesap kapanışını saklıyor. Aynı döküm Oral ve Hesap sekmelerinden yazdırılıyor. Plan kalemleri, planlama/faz sekmeleri, kopyalama ve sıralama davranışları da aktif; “AI ile Fazlara Böl” henüz yalnızca bilgilendirme mesajı gösteriyor.

Çalışma ağacı yoğun biçimde commit edilmemiş ve çok sayıda dosya Git açısından yeni görünüyor. Otomatik geri alma, reset veya geniş kapsamlı dosya temizliği yapılmamalı.

## Kritik Açık Noktalar

- Google OAuth `before-user-created` davranışı gerçek giriş akışında henüz doğrulanmadı. Allowlist dışı hesabın reddedildiği görülmeden auth güvenli kabul edilmemeli.
- Harici e-fatura veya e-SMM sağlayıcı entegrasyonu yok; mevcut gönderim sistem içi kayıt oluşturuyor.
- `treatment_plans` ve `treatment_plan_items` tablolarının migration kaynağı repository içinde görünmüyor. Yayın öncesinde şema kaynağı doğrulanmalı.
- Gerçek hasta verisi kullanılmadan önce yedekleme planı ve Supabase Pro gereksinimi değerlendirilmelidir.

## Sonraki Öncelikler

1. Auth güvenlik testini gerçek Google OAuth akışında tamamla.
2. Tedavi planı şemasını, RLS politikalarını ve migration kaynağını doğrula.
3. Oral planlama/faz ve tedavi dökümü akışını giriş yapılmış oturumda gerçek verilerle test et.
4. Gerekliyse `/api/ai-plan-phases` özelliğini ayrı ve onaylı görev olarak uygula.

Her yeni oturumda yalnızca bu özet ve `00_START_HERE.md` varsayılan olarak okunmalıdır.
