# TestSprite senaryoları (DentSoft)

Giriş gerektirmeyen test zaten çalıştırıldı ve geçti (korumalı sayfa yönlendirmesi + hatalı giriş).
Bu klasördeki 7 senaryo **giriş gerektirir**; gerçek şifre kullanılmaz, **TEST hesabı** kullanılır.

| # | Senaryo | Hesap |
|---|---|---|
| 01 | TEST hasta ekleme, TC 11 hane kuralı | Başhekim/mesul müdür TEST hesabı |
| 02 | Oral: planlama → indirim → tedaviye aktarım, sıra, mantık kuralları | aynı |
| 03 | Ödeme, bakiye, taksit; ödeme silince taksidin açılması; 100.000 biçimi | aynı |
| 04 | Kâğıt fatura (kısmi tutar), tutar sınırı, geri alma | aynı |
| 05 | Finans: gider → kasa, borç ödeme → defter, defterden silince borcun geri açılması | Finans izni olan hesap |
| 06 | Takip kutusuna işlem/seans ekleme-düzenleme-silme | aynı |
| 07 | Asistan yetkisi | **Yalnızca asistan rolündeki TEST hesabı** |

## Çalıştırmadan önce (siz yapacaksınız)
1. Ayarlar → Kullanıcı'dan TEST hesapları açın (örn. `test.baskan` ve `test.asistan`). Şifreyi sohbete yazmayın.
2. TestSprite hesabınızda projeye (DentSoft) giriş bilgilerini tanımlayın. Giriş formu 3 alanlıdır (klinik e-postası, kullanıcı adı, şifre).
3. 01 numaralı senaryo `TEST Senaryo HASTA` hastasını oluşturur; 02–04 ve 06 bu hastayı kullanır, bu yüzden sırayla çalıştırılmalıdır.

## Güvenlik
- Senaryolar yalnızca adı **TEST** ile başlayan kayıtlar oluşturur; gerçek hasta/ödeme verisine dokunmaz.
- Testler bitince TEST kayıtları Ayarlar/Hasta ekranlarından silinebilir.
