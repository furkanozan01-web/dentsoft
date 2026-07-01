# Kod Standartları

Bu belge refactor, ortak altyapı ve geniş kapsamlı kod görevlerinde okunur.

- Mevcut Next.js, React, Supabase ve yerel bileşen kalıplarını koru.
- Değişiklikten önce ilgili dosyaları ve çağrı zincirini oku; tüm projeyi gereksiz yere yükleme.
- Dar görevlerde alakasız refactor, stil değişikliği veya bağımlılık ekleme yapma.
- Mutasyonları Server Actions üzerinden ve klinik kapsamı doğrulanmış şekilde uygula.
- Kullanıcı bildirimlerinde `sonner`, onaylarda `useConfirm` kullan. Native `alert`, `prompt` ve genel `confirm` ekleme.
- Para dönüşümlerinde mevcut kuruş yardımcılarını, yerel tarihlerde ortak tarih yardımcılarını kullan.
- TypeScript türlerini koru; gereksiz `any`, zorlayıcı cast ve sessiz hata yutma ekleme.
- Test kapsamını değişikliğin riskine göre seç. En azından ilgili lint ve TypeScript kontrolünü çalıştır; geniş değişiklikte production build al.
- Çalışma ağacındaki kullanıcı değişikliklerini geri alma veya toplu biçimde yeniden yazma.

Next.js sürümüne özgü davranışlarda kökteki `../AGENTS.md` yönlendirmesine uy ve yalnızca ilgili yerel Next.js rehberini oku.
