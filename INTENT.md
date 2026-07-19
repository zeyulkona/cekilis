# INTENT.md — Etkinlik Bilet Dağıtım Sistemi

> Bu belge, projenin ürün ve davranış niyetini tanımlar. Çerçeve: **RTCS-G**
> (Role · Task&Format · Context&Constraint · Style&Tone · Guardrail).
> Uygulama kararları verilirken bu belge referans alınır; belirsiz bir durumda
> buradaki kurallar önceliklidir.

## Özet

Bir anket/çekiliş başka bir platformda yapılır. Kazananların **Ad Soyad ve
giriş numarası** birlikte, proje sahibi tarafından hazırlanmış bir Excel
dosyasıyla sisteme yüklenir (numaralar proje sahibi tarafından üretilir,
geliştirici/uygulama numara üretmez). Kazanan, herkese açık bir listeye
bakmak yerine
kendi giriş numarasını girer; sistem numarayı isimle eşleştirip bir
etkinlik/gün/saat seçmesine izin verir ve seçim sonrasında PDF bileti anında
indirir. Sistemde admin paneli, kullanıcı hesabı veya klasik kimlik
doğrulama (e-posta/şifre) yoktur — giriş numarası tek kullanımlık bir eşleşme
anahtarıdır, hesap değildir. Tüm veri yönetimi (etkinlik, kontenjan,
numara↔isim eşleşmesi, PDF) geliştirici tarafından kod/dosya seviyesinde
yapılır.

---

## 1. Role — Yönetim Modeli

- Sistemde **admin paneli yoktur**. Hiçbir ekran üzerinden etkinlik, kontenjan
  veya liste ekleme/düzenleme yapılmaz.
- Etkinlik tanımları, kontenjanlar, kazanan listesi ve PDF biletler
  **geliştirici tarafından statik veri/dosya olarak** projeye eklenir ve
  deploy edilir (örn. bir yapılandırma dosyası + PDF dosyaları).
- Yeni bir etkinlik eklemek, kontenjan değiştirmek veya yeni bir kazanan
  listesi yüklemek istendiğinde bu, geliştiriciye iletilen bir talep ile
  (kod değişikliği + deploy) gerçekleşir; runtime'da veri girişi yapılmaz.

## 2. Task & Format — Ürün Akışı

Uçtan uca akış:

1. **Anket/çekiliş** başka bir platformda yapılır (bu sistemin kapsamı dışında).
2. Proje sahibi, **Ad Soyad + giriş numarası** içeren Excel dosyasını
   hazırlar (numaraları kendisi üretir) ve geliştiriciye iletir; geliştirici
   bu eşleşmeyi olduğu gibi sisteme statik veri olarak işler (bkz. Bölüm 1).
   Uygulama numara üretmez/değiştirmez.
3. Kazanana giriş numarası ayrıca (bu sistemin dışında, ör. anket
   platformu/e-posta/SMS üzerinden) iletilir — bu iletim kanalı kapsam
   dışıdır.
4. Kullanıcı siteye girdiğinde tek alanlı bir **giriş paneli** görür: giriş
   numarasını yazar ve **Enter'a basarak** giriş yapar (ayrı bir "gönder"
   butonuna gerek yoktur, Enter tuşu yeterlidir). Sistem numarayı isimle
   eşleştirir ve kısa bir onay göstergesi (maskeli isim, ör. "Ay Ka") ile
   doğrular.
5. Kullanıcı, ilgili etkinlik için uygun **gün/saat kontenjanlarından**
   birini seçer.
6. Seçim onaylandığında o etkinliğe ait **PDF bilet doğrudan indirilir** ve
   giriş numarası kullanılmış olarak işaretlenir.

## 3. Context & Constraint — Veri Modeli & Kurallar

### Kontenjan
- Etkinlik başına bilet sayısı **20–60** arasında değişir.
- Her **etkinlik × gün × saat** kombinasyonunun kendi ayrı ve sınırlı
  kontenjanı vardır.
- Kontenjan dolan bir kombinasyon **arayüzde net biçimde "Dolu"** olarak
  işaretlenir ve seçilemez hale gelir.

### Giriş numarası ve isim eşleştirme
- Kazanan listesi **etkinlik bazlı** tutulur: bir kişi farklı etkinliklerde
  ayrı ayrı kazanan olarak listelenebilir; her etkinlikte kendi bağımsız
  giriş numarasına ve 1-seçim hakkına sahiptir.
- Herkese açık, gezilebilir bir kazanan listesi **yoktur**: kullanıcı başka
  kazananların isimlerini (maskeli dahi olsa) göremez. Erişim tamamen
  kişinin kendi giriş numarasını girmesiyle olur.
- Giriş numarası doğru girildiğinde, kullanıcıya kendi ismi **maskeli**
  gösterilir (adın ve soyadın ilk ikişer harfi, ör. "Ay Ka") — bu, "doğru
  numarayı mı girdim" onayı içindir, gizlilik amaçlı değildir (artık herkese
  açık bir liste olmadığı için tam isim göstermek de mümkündür; maskeleme
  sade bir onay adımı olarak korunur).
- Giriş numaraları proje sahibi tarafından üretildiği ve kişiye özel olduğu
  için **maske çakışması artık bir risk değildir**: eşleşme isimden değil,
  benzersiz numaradan yapılır. İki kişinin ismi/maskesi aynı olsa da her
  birinin giriş numarası farklıdır ve karışıklık oluşmaz.

### Karar süresi (5 dakika kuralı)
- Kullanıcı bir gün/saat seçimini değerlendirmeye (kilitlemeye) başladığında
  **5 dakikalık karar süresi** başlar.
- Bu süre boyunca üzerinde düşünülen slot **kilitli** kabul edilir; başka
  hiçbir kullanıcı bu süre zarfında o slotu görüp seçemez / listede
  kullanılabilir olarak göremez.
- Süre dolar ve seçim tamamlanmazsa (bilet indirilmezse), kilit otomatik
  kalkar; kişi "henüz bilet almamış" durumuna geri döner ve tekrar
  bir slot seçebilir; slot da tekrar başkalarına açılır.

### Tekillik kuralı ve teknik uygulaması
- **Zorunlu kural:** Bir giriş numarası yalnızca **bir kez** bilet seçimi
  için kullanılabilir; başarılı bir seçimden sonra o numara
  **"kullanıldı"** olarak işaretlenir ve bir daha bilet seçimi için
  kullanılamaz (numara ile tekrar girilip mevcut/geçmiş seçim
  görüntülenebilir, ama yeni bir seçim yapılamaz).
- Bu, sunucu tarafında **otoriter ve tam garantili** bir kuraldır: giriş
  numarası zaten kişiye özel ve tek olduğundan, önceki tasarımdaki
  cihaz/tarayıcı bazlı ikincil kısıta (bkz. eski revizyon) artık gerek
  yoktur — numaranın kendisi tekilliği doğrudan sağlar.

### PDF biletler
- PDF biletler **etkinliğe özeldir, kişiye özel değildir**: bir etkinliği
  seçen herkes aynı PDF dosyasını indirir. Etkinlik başına tek bir PDF
  bulunur (gün/saat'e göre farklılaşmaz).

### Excel veri aktarımı
- Kazanan listesi **statik/geliştirici eliyle** aktarılır: proje sahibi,
  **Ad Soyad ve giriş numarasını birlikte içeren** Excel dosyasını
  hazırlayıp geliştiriciye iletir; geliştirici bu eşleşmeyi olduğu gibi
  (değiştirmeden/yeniden üretmeden) sisteme statik veri olarak işler ve
  deploy eder. **Uygulama giriş numarası üretmez** — numaralar Excel'de
  zaten hazır gelir.
- Ayrı bir "dosya yükleme" arayüzü/endpoint'i **yoktur** — bu, admin paneli
  olmaması ilkesiyle tutarlıdır.
- Giriş numaralarının kazananlara nasıl iletileceği (e-posta, SMS, anket
  platformu vb.) bu sistemin kapsamı dışındadır.

## 4. Style & Tone — Tasarım Referansı

- Görsel ilham kaynağı: **İKSV (İstanbul Kültür Sanat Vakfı)** web sitesi.
- Sade, zarif, kültür/sanat odaklı bir tasarım dili; yoğun beyaz alan
  kullanımı; tipografinin öne çıktığı, dekoratif öğelerin minimize edildiği
  bir görsel yaklaşım.
- Marka, logo, renk paleti gibi somut detaylar bir panelden yönetilmez;
  geliştiriciye iletilen görsel/renk kodları üzerinden koda **sabit** olarak
  işlenir.

## 5. Guardrail — Güvenlik Kuralları

- **Ekstra kimlik doğrulama yoktur**: e-posta, şifre veya doğrulama kodu
  girişi istenmez. Giriş numarası bir hesap değil, tek kullanımlık bir
  eşleştirme anahtarıdır.
- **Tek zorunlu kural**: bir giriş numarası birden fazla seçim yapamaz
  (bkz. Bölüm 3, "Tekillik kuralı").
- Giriş paneli, yanlış/var olmayan bir numara girildiğinde genel bir hata
  mesajı gösterir (hangi numaraların geçerli olduğuna dair bilgi sızdırmaz,
  numara enumerasyonuna karşı brute-force'u kolaylaştıracak ayrıntı vermez).
- **Race condition koruması**: bir slot seçilip kilitlendiğinde, o slot
  eşzamanlı olarak başka bir kullanıcı tarafından görülüp seçilemez
  (sunucu tarafında atomik kilitleme gereklidir).
- **Kontenjan görünürlüğü**: dolu kombinasyonlar arayüzde açıkça ve
  yanıltmayacak şekilde "Dolu" olarak işaretlenir.

---

## Revizyon geçmişi

- **v3 — Numara üretimi ve giriş etkileşimi:** Proje sahibi, giriş
  numaralarını kendisi üretip Ad Soyad ile eşleştirerek Excel'i doğrudan
  kendisi yükleyeceğini belirtti (v2'deki "geliştirici numara üretir"
  varsayımı **geçersiz kılındı** — bkz. Bölüm 2 ve "Excel veri aktarımı").
  Giriş paneli tek alanlı olacak ve **Enter'a basarak** gönderilecek şekilde
  netleştirildi (bkz. Bölüm 2, adım 4).
- **v2 — Giriş numarası modeli:** Proje sahibi, herkese açık maskeli liste
  üzerinden "kendini bulup seçme" akışını, her kazanana atanan **benzersiz
  bir giriş numarası** ile erişim akışına değiştirdi. Bu değişiklik önceki
  sürümdeki iki maddeyi **geçersiz kılar**:
  - Eski "maske çakışması → sıra numarası ekle" çözümü artık gerekli
    değildir (eşleştirme isme değil numaraya dayanıyor).
  - Eski "isim satırı kilidi + tarayıcı bazlı ikincil kısıt" tekillik
    mekanizması, tek başına yeterli olan **giriş numarası tekilliği** ile
    değiştirildi (bkz. Bölüm 3, "Tekillik kuralı").
  - Herkese açık kazanan listesi kaldırıldı; erişim bir **giriş paneli**
    (numara girişi) üzerinden yapılır (bkz. Bölüm 2 ve 3).

## Bu belgede geliştirici tarafından alınan kararlar

Aşağıdaki noktalar proje sahibi tarafından "kendin karar ver" denilerek
geliştiriciye bırakılmıştır:

1. Giriş numarası doğrulandıktan sonra kullanıcıya tam isim yerine
   **maskeli isim** gösterilmesi (kısa bir "doğru numara" onayı olarak) —
   Bölüm 3, "Giriş numarası ve isim eşleştirme".
2. Geçersiz numara girişinde numara enumerasyonunu kolaylaştırmayacak genel
   bir hata mesajı gösterilmesi — Bölüm 5.

## Kapsam dışı (Out of scope)

- Anket/çekiliş sürecinin kendisi (başka platformda yürütülür).
- Kullanıcı hesabı, giriş/kayıt akışı, e-posta/SMS doğrulama.
- Admin paneli veya herhangi bir runtime veri yönetim arayüzü.
- Kişiye özel (unique) PDF üretimi — biletler etkinlik başına ortaktır.
