# AI Güvenlik ve Veri Kuralları

Bu belge yalnızca auth, Supabase, migration, hassas veri veya kullanıcı yönetimi görevlerinde okunur.

## Temel Kurallar

- Her sorgu ve mutasyon klinik kapsamını `clinic_id` ile doğrulamalıdır; yalnızca istemci filtresine güvenilmez.
- `SUPABASE_SERVICE_ROLE_KEY` hiçbir istemci dosyasına veya `NEXT_PUBLIC_` değişkenine taşınmaz.
- T.C. kimlik ve anamnez düz metin saklanmaz. Mevcut şifreleme akışı korunur.
- Para değerleri integer kuruş, yüzde oranları uygun olduğunda basis point kullanır.
- Auth ve rol kararlarında kullanıcı tarafından değiştirilebilir metadata kullanılmaz.
- Gerçek hasta verisi, anahtarlar veya kişisel bilgiler loglara ve dokümanlara yazılmaz.

## Migration Güvenliği

- `CREATE`, güvenli `ALTER` ve ekleyici migration işlemleri tercih edilir.
- `DROP`, `DELETE`, `TRUNCATE` veya mevcut veriyi dönüştüren riskli SQL için Furkan'ın açık onayı gerekir.
- Yeni tablolar `clinic_id`, gerekli indeksler ve uygun RLS politikaları olmadan tamamlanmış sayılmaz.
- Büyük migration öncesinde yedekleme durumu doğrulanır.

## İşlem Disiplini

- Kullanıcının mevcut değişiklikleri geri alınmaz veya ezilmez.
- Belge ile uygulama çelişirse kaynak kod, migration ve gerçek davranış doğrulanır.
- Hassas veya geri döndürülemez işlem öncesinde kapsam açıkça belirtilir ve onay alınır.
