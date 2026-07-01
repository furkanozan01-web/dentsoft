# DentSoft Mimari Referansı

Bu belge Supabase, veri modeli, ortak altyapı veya mimari değişikliklerde okunur.

## Katmanlar

- UI: Next.js 16 App Router, React 19, TypeScript ve Tailwind CSS.
- Sunucu: Server Components, Server Actions ve gerektiğinde Route Handlers.
- Veri: Supabase PostgreSQL, Auth, Storage ve RLS.
- Bildirim ve grafik: sonner ve recharts.
- Yerel çalışma: PM2 veya Next.js geliştirme sunucusu, varsayılan proje portu 3001.

## Modül Sınırları

- `src/app/page.tsx`: dashboard.
- `src/app/patients/`: hasta, tedavi, hesap, fatura, reçete, görüntü ve takip.
- `src/app/appointments/`: randevu takvimi ve randevu mutasyonları.
- `src/app/finance/`: gelir, gider, bakiye ve hekim ödemeleri.
- `src/app/settings/`: klinik, hekim, kullanıcı, tarife ve randevu ayarları.
- `src/lib/supabase/`: tarayıcı, sunucu ve admin Supabase istemcileri.
- `src/lib/peri/`: PERİ araç tanımları ve sunucu yürütücüsü.
- `supabase/migrations/`: sürümlenen veritabanı değişiklikleri.

## Veri İlkeleri

Her klinik verisi `clinic_id` ile ayrılır ve RLS ile korunur. Server Action girdileri güvenilmez kabul edilir; hasta, hekim ve kayıt ilişkileri sunucuda tekrar doğrulanır. Storage yolları klinik ve hasta kapsamını içermelidir. Hassas alanlar uygulama katmanında şifrelenir. Para alanları integer kuruş olarak taşınır.

Hasta ekranının orkestrasyonu `PatientsClient.tsx` içindedir; sekmeler ayrı bileşenlerde tutulur. Büyük sekmeleri yeniden monolitik bileşene birleştirme.

Tedavi ücretlerinde `original_fee` değişmeyen ilk tarife tutarı, `fee` güncel net tutar ve `is_closed` hesap kapanış durumudur. Ücret ayarlamaları yalnızca açık tedavilere Server Action üzerinden uygulanır. Oral ve Hesap sekmelerinin A4 çıktısı `TreatmentStatementPrint.tsx` ortak bileşenidir.
