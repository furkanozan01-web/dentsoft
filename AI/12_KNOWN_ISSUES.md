# DentSoft Bilinen Sorunlar

Bu belge yalnızca ilgili hata araştırılırken veya yeni kritik sorun kaydedilirken okunur. Sıradan görevlerde yüklenmez.

| ID | Durum | Modül | Özet |
|---|---|---|---|
| ISSUE-001 | Açık | Fatura | Harici e-fatura/e-SMM sağlayıcı entegrasyonu yok |
| ISSUE-002 | Doğrulama bekliyor | Auth | Google OAuth allowlist ve `before-user-created` gerçek akış testi tamamlanmadı |
| ISSUE-003 | Doğrulama bekliyor | Oral/Supabase | Tedavi planı tablolarının repository migration kaynağı görünmüyor |

## ISSUE-001

“Gönder” işlemi ödeme kaydına fatura numarası, kurum, tutar, KDV ve gönderim tarihi yazar; harici kuruma API çağrısı yapmaz. Sağlayıcı seçildikten sonra server-side gönderim, durum sorgulama ve tekrar deneme akışı eklenmelidir.

## ISSUE-002

Klinik yöneticisinin Google OAuth ile doğru `clinic_id` ve `admin` rolü aldığı, allowlist dışı hesabın reddedildiği gerçek hesaplarla doğrulanmalıdır. Bu test tamamlanmadan auth üretim için güvenli kabul edilmez.

## ISSUE-003

Kaynak kod `treatment_plans` ve `treatment_plan_items` tablolarını kullanıyor; mevcut migration klasöründe bu tabloları oluşturan dosya görünmüyor. Remote şema ve migration geçmişi doğrulanmalı, gerekiyorsa güvenli ve ekleyici migration oluşturulmalıdır.

Yeni sorunlar yalnızca açık, tekrarlanabilir veya oturumlar arası takip gerektiriyorsa eklenir. Çözülen sorunlar changelog'a taşınabilir.
