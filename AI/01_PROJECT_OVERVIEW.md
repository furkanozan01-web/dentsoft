# DentSoft Proje Genel Bakış

Bu belge ürün kapsamı veya yabancı bir modül üzerinde çalışırken referans olarak okunur. Günlük durum için `01_CURRENT_CONTEXT.md`, teknik yapı için `05_ARCHITECTURE.md` kullanılır.

DentSoft, Türkiye'deki diş klinikleri için geliştirilmiş çok kiracılı bir klinik yönetim uygulamasıdır. Hasta kayıtları, odontogram ve tedavi planları, randevu, finans, fatura, reçete, klinik notlar, görüntüler ve takip süreçlerini tek uygulamada birleştirir.

## Modüller

| Modül | Konum |
|---|---|
| Dashboard | `src/app/page.tsx` |
| Hasta yönetimi | `src/app/patients/` |
| Randevu | `src/app/appointments/` |
| Finans | `src/app/finance/` |
| Ayarlar | `src/app/settings/` |
| PERİ altyapısı | `src/lib/peri/` |

Hasta yönetimi ayrı sekme bileşenlerine bölünmüştür. `PatientsClient.tsx` orkestrasyonu yürütür; liste, hasta kartı, oral, hesap, fatura, not ve görüntü, reçete ve takip ekranları kendi dosyalarında bulunur.

## Temel Teknolojiler

Next.js 16.2.9, React 19, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, sonner ve recharts.

## Hasta URL Parametreleri

- `patient_id`: hastayı seçer.
- `tab`: hasta sekmesini açar.
- `pay=1`: ödeme modalını açar.
- `action=new`: yeni hasta akışını başlatır.
- `filter=ongoing`: devam eden tedavileri filtreler.

Güvenlik ve veri kuralları için `02_AI_GUIDELINES.md` okunmalıdır.
