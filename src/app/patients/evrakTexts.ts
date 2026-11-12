// Onam formu metinleri — hekimin onayladığı hali, DEĞİŞTİRİLMEDEN (kaynak: onam-formu.html).
// ["h", başlık] · ["p", paragraf] · ["ul", madde listesi]
export type DocPart = ['h' | 'p', string] | ['ul', string[]]
export type DocDef = { title: string; body: DocPart[] }

export const GENEL: DocDef = {title:"GENEL BİLGİLENDİRME VE GENEL ONAM FORMU",body:[
 ["h","1. MUAYENE VE TEDAVİ PLANI"],
 ["p","Ağız ve diş sağlığımın değerlendirilmesi için klinik muayene yapılacağı, gerekli görüldüğünde radyografi, canlılık testi ve diğer tanısal incelemelerin uygulanabileceği tarafıma açıklandı. Muayene sonucunda sorunlarım, önerilen tedavi, alternatifleri, yararları, riskleri ve tedavi yapılmazsa doğabilecek sonuçlar hakkında bilgilendirileceğim. Tedavi planı süreç içinde değişebilir. Yeni veya farklı bir müdahale gerekirse ayrıca onamım alınacaktır."],
 ["h","2. ANESTEZİ VE TEDAVİ SONUÇLARI"],
 ["p","Tedavinin niteliğine göre lokal anestezi uygulanabileceği, anestezi ve diğer müdahalelerde beklenmeyen reaksiyon, alerji ve komplikasyonlar gelişebileceği anlatıldı. İşleme özgü riskler ilgili ek onam formunda açıklanacaktır. Tedavi sonucunun genel sağlık durumumdan, iyileşme sürecimden, alışkanlıklarımdan ve bakımımdan etkileneceği, hiçbir tedavinin sonucu veya kullanım ömrü için kesin başarı garantisi verilemeyeceği tarafıma açıklandı."],
 ["h","3. SORUMLULUKLARIM"],
 ["p","Sağlık durumum, hastalıklarım, kullandığım ilaçlar ve alerjilerim hakkında doğru ve eksiksiz bilgi vereceğim, değişiklikleri hekimime bildireceğim. Ağız hijyenime dikkat etmem, ilaçları tarif edildiği şekilde kullanmam, kontrol randevularına gelmem ve hekimimin önerilerine uymam gerektiğini biliyorum."],
 ["h","4. HAKLARIM"],
 ["p","Soru sorma, açıklama isteme ve başka bir hekimden görüş alma hakkım olduğu bana bildirildi. Önerilen tedaviyi reddedebileceğimi, başlamış tedaviyi mevzuatın izin verdiği ölçüde durdurabileceğimi ve rızamı müdahale başlamadan geri çekebileceğimi biliyorum. Bu kararların olası sonuçları tarafıma açıklanacaktır."],
 ["h","5. KİŞİSEL VERİLER VE İZİNLER"],
 ["p","Kişisel ve sağlık verilerimin tanı, tedavi ve kayıt amacıyla mevzuata uygun olarak işleneceği, gizliliğinin korunacağı ve yalnızca gerekli ölçüde yetkili sağlık çalışanları ve kuruluşlarla paylaşılacağı konusunda bilgilendirildim. Bu konudaki haklarım ve başvuru yolları da bana anlatıldı."],
 ["p","Girişim sırasında çıkarılan dokuların muayene, tetkik ve imha edilmesine izin veriyorum."],
 ["p","Bana / vasisi olduğum kişiye ait radyografi, fotoğraf, video ve diğer kayıtların, kimlik bilgileri gizlenerek eğitim ve bilimsel amaçlı çalışmalarda kullanılmasına izin veriyorum."],
 ["h","6. ÖDEME"],
 ["p","İşlemlerin karşılığı olan toplam meblağı borçlu sıfatı ile ödeyeceğimi taahhüt eder, aksi halde yasal işlemlerle karşı karşıya kalacağımı kabul ederim."],
 ["h","7. GENEL ONAM BEYANI"],
 ["p","Yukarıdaki bilgileri okudum ve anladım. Sorularımı sorma fırsatım oldu ve sorularım yanıtlandı. Bu formun tedaviye özgü ek onam formlarının yerine geçmediğini biliyorum. Klinik muayenemin yapılmasına ve gerekli tanısal değerlendirmelerin gerçekleştirilmesine onay veriyorum."]
]}

export const COCUK: DocDef = {title:"ÇOCUK HASTA BİLGİLENDİRME VE VELİ / YASAL TEMSİLCİ ONAM FORMU",body:[
 ["h","1. MUAYENE VE TEDAVİ PLANI"],
 ["p","Çocuğumun ağız ve diş sağlığının değerlendirilmesi için klinik muayene yapılacağı, gerekli görüldüğünde radyografi, canlılık testi ve diğer tanısal incelemelerin uygulanabileceği tarafıma açıklandı. Muayene sonucunda tespit edilen sorunlar, önerilen tedavi, alternatifleri, yararları, riskleri ve tedavi yapılmazsa doğabilecek sonuçlar hakkında bilgilendirileceğim. Tedavi planında değişiklik veya farklı bir müdahale gerekirse ayrıca onamım alınacaktır."],
 ["h","2. ÇOCUK HASTAYA YAKLAŞIM VE TEDAVİ SÜRECİ"],
 ["p","Muayene ve tedaviler hakkında çocuğuma yaşına ve anlayabilme düzeyine uygun bir dille açıklama yapılacağını, görüşlerinin ve kaygılarının dikkate alınacağını biliyorum. Tedavinin niteliğine göre lokal anestezi ve çeşitli müdahaleler uygulanabileceği, bunlara bağlı istenmeyen reaksiyon veya komplikasyonlar gelişebileceği anlatıldı. İşleme özgü riskler ilgili ek onam formunda açıklanacaktır. Tedavi sonucunun çocuğumun genel sağlığından, biyolojik gelişiminden, ağız hijyeninden ve tedavi sonrası bakımdan etkileneceği, hiçbir tedavinin kesin başarı garantisi olmadığı tarafıma açıklandı."],
 ["h","3. VELİ / YASAL TEMSİLCİNİN SORUMLULUKLARI"],
 ["p","Çocuğumun sağlık durumu, geçirdiği hastalıklar, kullandığı ilaçlar ve alerjileri hakkında doğru ve eksiksiz bilgi vereceğim, değişiklikleri hekime bildireceğim. Çocuğumun ağız hijyenine dikkat etmesini, önerilen bakım uygulamalarını yerine getirmesini ve kontrol randevularına gelmesini sağlayacağım."],
 ["h","4. KİŞİSEL VERİLER VE İZİNLER"],
 ["p","Çocuğumun kişisel ve sağlık verilerinin tanı, tedavi ve kayıt amacıyla mevzuata uygun olarak işleneceği, gizliliğinin korunacağı ve yalnızca gerekli ölçüde yetkili sağlık çalışanları ve kuruluşlarla paylaşılacağı konusunda bilgilendirildim."],
 ["p","Girişim sırasında çıkarılan dokuların muayene, tetkik ve imha edilmesine izin veriyorum."],
 ["p","Çocuğuma ait radyografi, fotoğraf, video ve diğer kayıtların, kimlik bilgileri gizlenerek eğitim ve bilimsel amaçlı çalışmalarda kullanılmasına izin veriyorum."],
 ["h","5. ÖDEME"],
 ["p","İşlemlerin karşılığı olan toplam meblağı borçlu sıfatı ile ödeyeceğimi taahhüt eder, aksi halde yasal işlemlerle karşı karşıya kalacağımı kabul ederim."],
 ["h","6. VELİ / YASAL TEMSİLCİ ONAM BEYANI"],
 ["p","Yukarıdaki bilgileri okudum ve anladım. Sorularımı sorma fırsatım oldu ve sorularım yanıtlandı. Bu formun tedaviye özgü ek onam formlarının yerine geçmediğini biliyorum. Çocuğumun üstün yararı doğrultusunda klinik muayenesinin yapılmasına ve gerekli tanısal değerlendirmelerin gerçekleştirilmesine izin veriyorum. Rızamı mevzuat ve tıbbi gereklilikler çerçevesinde geri çekebileceğimi biliyorum."]
]}

export const CERRAHI: DocDef = {title:"AĞIZ, DİŞ VE ÇENE CERRAHİSİ EK ONAM FORMU",body:[
 ["h","İşlemin kapsamı"],
 ["p","Ağız, diş ve çene cerrahisi; diş çekimi, gömülü diş operasyonları, implant, kemik grefti, sinüs lifting, flep operasyonları ve benzeri işlemleri kapsar. İşlemin niteliğine göre diş etinin kaldırılması (flep), kemiğin şekillendirilmesi, diş veya kök parçalarının çıkarılması, implant ya da greft uygulanması ve dikiş atılması gerekebilir. İmplant uygulamalarında kemik yetersizliği veya anatomik koşullar nedeniyle ek cerrahi işlem ve ağız içinden ya da başka bir bölgeden doku alınması gerekebilir."],
 ["p","İmplantın kemikle kaynaşması için genellikle birkaç ay beklenir. Ardından üst yapı (kuron, köprü veya protez) yapılır."],
 ["h","Olası riskler ve komplikasyonlar"],
 ["ul",[
  "Kanama, hematom, enfeksiyon, yara iyileşmesinde gecikme ve dikişlerin açılması.",
  "Çekim sonrası alveolit (kuru soket), kemik çıkıntıları ve ağız açmada kısıtlılık.",
  "Dişin veya köklerin kırılması. Anatomik yapılara zarar vermemek için kök parçaları yerinde bırakılabilir.",
  "Komşu dişlerde, dolgu ve kuronlarda veya çevre dokularda hasar.",
  "Özellikle alt çenede sinirlerin etkilenmesine bağlı dudak, çene veya dilde geçici, nadiren kalıcı his kaybı.",
  "Üst çene arka bölgede sinüs ile ağız arasında açıklık oluşması; diş, kök parçası veya implantın sinüse kaçması.",
  "Sinüs lifting sırasında sinüs zarının yırtılması ve sinüs enfeksiyonu.",
  "Greftlerde materyalin açığa çıkması, enfekte olması, erimesi veya beklenen dokunun oluşmaması; doku alınan bölgede iyileşme sorunları.",
  "İmplantın kemikle bütünleşememesi, implant kaybı, implant çevresinde enfeksiyon veya kemik kaybı. Uzun dönemde vida gevşemesi, implant veya üst yapı kırığı.",
  "Flep ve diş eti cerrahileri sonrası diş eti çekilmesi, kök yüzeylerinin açığa çıkması, hassasiyet ve estetik değişiklik.",
  "Nadiren, zor ve derin gömülü diş çekimlerinde çene kemiğinde kırık.",
  "Kemik erimesi veya kanser tedavisinde kullanılan bazı ilaçları (bisfosfonat, denosumab vb.) kullananlarda ve baş-boyun bölgesine radyoterapi alanlarda çene kemiğinde iyileşmeme (osteonekroz)."]],
 ["p","Sigara, kontrolsüz diyabet, kan sulandırıcı kullanımı ve yetersiz ağız bakımı komplikasyon riskini artırır, implant başarısını azaltır."],
 ["h","Ek işlemler ve alternatifler"],
 ["p","Bazı komplikasyonlar ek tedavi, yeniden cerrahi müdahale veya başka bir hekimden destek alınmasını gerektirebilir. Cerrahi sırasında karşılaşılan anatomik veya klinik durumlara göre planlanan işlem değiştirilebilir, ertelenebilir ya da durdurulabilir. İşlemin alternatifleri, yapılmaması veya ertelenmesi durumunda doğabilecek sonuçlar ve bana özgü riskler tarafıma açıklandı."]
]}

export const RESTO: DocDef = {title:"RESTORATİF, ENDODONTİK VE PROTETİK TEDAVİLER EK ONAM FORMU",body:[
 ["p","Bu tedaviler, çürük, kırık, travma, madde kaybı veya pulpa ve çevre doku hastalıkları nedeniyle oluşan fonksiyonel ve estetik sorunların giderilmesini amaçlar. Dolgu, kanal tedavisi ve yenilemesi, kuron, köprü, inley, onley ile sabit veya hareketli protezler bu kapsamdadır."],
 ["h","1. Restoratif tedaviler (dolgu)"],
 ["p","Çürük veya hasarlı doku temizlenir, diş uygun materyalle onarılır."],
 ["ul",[
  "İşlem sonrası geçici veya uzun süreli sıcak-soğuk hassasiyeti ve ağrı oluşabilir.",
  "Derin çürüklerde pulpa etkilenebilir veya canlılığını kaybedebilir; kanal tedavisi gerekebilir.",
  "Dolguda zamanla aşınma, kırılma, renk değişikliği veya kenar uyumsuzluğu gelişebilir; yenilenmesi gerekebilir.",
  "Büyük madde kayıplarında dolgu yeterli dayanıklılığı sağlayamayabilir; kuron veya başka bir protetik restorasyon önerilebilir.",
  "Dolgu sonrası kapanışta yükseklik hissi olabilir; düzeltme gerekebilir."]],
 ["h","2. Endodontik tedaviler (kanal tedavisi)"],
 ["p","İltihaplı, enfekte veya canlılığını kaybetmiş pulpa çıkarılır; kanal sistemi temizlenir, şekillendirilir ve doldurulur. Gerektiğinde önceki kanal tedavisi yenilenir."],
 ["ul",[
  "Tedavi sırasında veya sonrasında ağrı, hassasiyet, çiğnemede rahatsızlık ve geçici iltihap görülebilir.",
  "Dar, kireçlenmiş veya eğri kanallar nedeniyle kanallar tam temizlenemeyebilir veya bulunamayabilir.",
  "Kanal aletinin kırılması, dolgu materyalinin kök ucundan taşması veya perforasyon gelişebilir.",
  "Enfeksiyon devam edebilir veya tekrarlayabilir. Bu durumda kanal tedavisinin yenilenmesi, cerrahi endodontik işlem veya çekim gerekebilir.",
  "Kanal tedavili dişlerde, özellikle madde kaybı fazlaysa, kırılma riski artar. Dişin korunması için ek restoratif veya protetik uygulama gerekebilir.",
  "Seanslar arasında geçici dolgu düşebilir veya diş kırılabilir. Bu dönemde o tarafla sert yiyecek çiğnenmemelidir."]],
 ["h","3. Protetik tedaviler"],
 ["p","Kırılmış, madde kaybı olan veya eksik dişlerin fonksiyon, konuşma ve estetiği sabit veya hareketli protezlerle yeniden kazandırılır."],
 ["ul",[
  "Dişlerin hazırlanması sırasında sağlıklı diş dokusu kaldırılabilir. Sonrasında hassasiyet ve bazen kanal tedavisi ihtiyacı doğabilir.",
  "Geçici veya daimi protezlerde kırılma, çatlama, yerinden çıkma, uyum bozukluğu ya da renk ve estetik beklentiyle ilgili memnuniyetsizlik olabilir.",
  "Protez altındaki dişlerde çürük, diş eti iltihabı, diş eti çekilmesi veya destek dişlerde zamanla hasar gelişebilir.",
  "Köprülerde uzun dönem başarı, destek dişlerin taşıma kapasitesine ve kuvvet dağılımına bağlıdır.",
  "Hareketli protezlerde başlangıçta vuruk, hassasiyet, konuşma ve çiğneme güçlüğü olabilir; alışma süreci ve düzeltmeler gerekebilir.",
  "Protezin ömrü ağız hijyenine, düzenli kontrollere, çiğneme kuvvetlerine ve materyal özelliklerine bağlıdır."]],
 ["h","4. Alternatifler ve ek işlemler"],
 ["p","Dişin durumuna göre restorasyonun yenilenmesi, kanal tedavisi veya yenilemesi, protetik restorasyon, cerrahi tedavi ya da çekim gibi seçenekler bulunabilir. Tedavi yöntemi; dişin durumu, kalan sağlam doku, çevre dokuların sağlığı ve klinik ihtiyaçlarım dikkate alınarak belirlenir. Tedavi sırasında öngörülmeyen ek işlemler gerekebileceği, bunların bana açıklanacağı ve gerektiğinde ayrıca onamımın alınacağı tarafıma anlatıldı."]
]}
