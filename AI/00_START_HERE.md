# DentSoft AI Başlangıç Yönlendirmesi

Bu dosyayı ve `01_CURRENT_CONTEXT.md` dosyasını yeni oturumda bir kez oku. Diğer belgeleri yalnızca görev gerektiriyorsa aç.

## Belge Seçimi

| Görev | Ek olarak okunacak belge |
|---|---|
| Küçük UI veya dar hata düzeltmesi | Yok |
| Auth, kullanıcı veya yetki | `02_AI_GUIDELINES.md`, `09_DECISIONS.md` |
| Supabase, migration veya veri modeli | `05_ARCHITECTURE.md`, `02_AI_GUIDELINES.md`, ilgili kararlar |
| Refactor veya ortak altyapı | `04_CODE_STANDARDS.md`, gerekirse `05_ARCHITECTURE.md` |
| Yeni özellik | İlgili `03_PROJECT_REPORT.md` bölümü, gerekirse `10_ROADMAP.md` |
| Bilinen hata araştırması | Yalnızca ilgiliyse `12_KNOWN_ISSUES.md` |
| Geçmiş değişiklik araştırması | `08_CHANGELOG.md` veya `archive/` |
| Mimari değişiklik | İlgili tüm referans belgeleri |

`01_PROJECT_OVERVIEW.md` ürün ve modül haritasıdır. `11_SESSION_LOG.md` yalnızca önemli oturum devri gerektiğinde okunur.

## Güncelleme Matrisi

- Küçük UI veya dar hata: belge güncellemesi zorunlu değil.
- Yeni özellik: `08_CHANGELOG.md` ve `03_PROJECT_REPORT.md`.
- Mimari karar: `09_DECISIONS.md` ve `05_ARCHITECTURE.md`.
- Yeni veya devam eden kritik hata: `12_KNOWN_ISSUES.md`.
- Aktif durum veya öncelik değişikliği: `01_CURRENT_CONTEXT.md`.
- Önemli oturum devri: `11_SESSION_LOG.md`.

Bir bilgi zaten mevcut context içindeyse belgeyi yeniden yükleme. Doküman ile kod çelişirse önce kaynak kodu doğrula.
