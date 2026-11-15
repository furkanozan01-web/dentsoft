/**
 * Kullanıcı adı anahtarı: başındaki/sonundaki boşluklar atılır; büyük/küçük harf ve Türkçe i/ı/İ/I farkı gözetilmez
 * ("İlayda", "ilayda", "ILAYDA", "Ilayda" aynı kullanıcıdır). Giriş ekranı ve kullanıcı kaydı aynı fonksiyonu kullanır.
 * Başka bir biçim kuralı yoktur.
 */
export function usernameKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
}
