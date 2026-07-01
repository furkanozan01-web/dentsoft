@AGENTS.md

Yeni oturumda yalnızca `AI/00_START_HERE.md` ve `AI/01_CURRENT_CONTEXT.md` dosyalarını oku.
Göreve özel diğer belgeleri `AI/00_START_HERE.md` yönlendirmesine göre, yalnızca gerektiğinde oku.
Aynı oturumda içeriği değişmemiş bir belgeyi tekrar okuma.
Küçük görevlerde referans, geçmiş ve yol haritası belgelerini yükleme.
Dokümantasyonu yalnızca görev sonunda gerçekten değişmesi gereken dosyalarda güncelle.

## Rol sistemi

Rol sistemi Aşama 1 tamamlandı: roller yeniden adlandırıldı
(bashekim/responsible_manager/hekim/asistan), `role_permissions` +
`patient_assignments` tabloları eklendi, `lib/permissions.ts` yardımcısı
ve Ayarlar → Kullanıcı sekmesindeki izin matrisi UI'ı canlıya alındı.

Rol bazlı izin + kullanıcı bazlı override sistemi de eklendi:
`role_permissions` (rol şablonu) + `user_permissions` (kullanıcı bazlı
istisna, NULL alan = rol şablonuna düşer). `lib/permissions.ts` ve
`settings/actions.ts`'teki `getEffectivePermissions`/`updateUserPermission`/
`resetUserPermissions` bu iki tabloyu birleştirir (merge). Ayarlar →
Kullanıcı sekmesinde her kullanıcı satırında "İzinleri Düzenle" (anahtar
ikonu) ile açılan panel bu override'ları düzenler.

Aşama 2 (yapılmadı, bekliyor): `audit_logs` tablosu, `patient_shares`
(hasta paylaşımı), `doctor_clinics` (çok şube desteği), `middleware.ts`
üzerinden tam sayfa koruması, `canAccessPatient()` tam enforcement.

## Etik İş Kuralları

1. **Hasta erişimi:** `patient_assignments` tablosu üzerinden — hekim
   sadece kendi atanmış hastasını görür/düzenler.
2. **Hakediş görünürlüğü:** `hakedis_tum` izni olan roller (bashekim,
   mesul müdür) tüm hekimleri görür; hekim sadece kendi satırını görür.
3. **Tedavi doctor_id:** her zaman işlemi yapan hekimin ID'sidir,
   değiştirilemez.
4. **Silme:** rol şablonunda varsayılan kapalıdır.
5. **Kullanıcı override:** bashekim her kullanıcı için rol şablonundan
   bağımsız izin verebilir; override edilen hücreler sarı ile gösterilir.
