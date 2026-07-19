# INTENT.md — Etkinlik Bilet Dağıtım Sistemi

> Bu belge, projenin ürün ve davranış niyetini tanımlar. Çerçeve: **RTCS-G**
> (Role · Task&Format · Context&Constraint · Style&Tone · Guardrail).
> Uygulama kararları verilirken bu belge referans alınır; belirsiz bir durumda
> buradaki kurallar önceliklidir.

## Özet

Sistemde iki panel vardır: bir **admin paneli** ve bir **kullanıcı paneli**.
Bir anket/çekiliş başka bir platformda yapılır. Proje sahibi, admin panelinden
etkinlik/gün/saat/kontenjan tanımlarını yönetir, kazananların **Ad Soyad ve
giriş numarası** eşleşmesini içeren Excel dosyasını yükler ve etkinliğin PDF
biletini yükler (numaraları proje sahibi kendisi üretir; sistem numara
üretmez). Kazanan, herkese açık bir listeye bakmak yerine kullanıcı
panelinde kendi giriş numarasını girer; sistem numarayı isimle eşleştirip
bir etkinlik/gün/saat seçmesine izin verir ve seçim sonrasında PDF bileti
anında indirir. Kullanıcı tarafında klasik kimlik doğrulama (e-posta/şifre)
yoktur — giriş numarası tek kullanımlık bir eşleşme anahtarıdır, hesap
değildir. Admin paneli ise şifre/hesap yerine gizli, tahmin edilemez bir URL
ile korunur (bkz. Bölüm 1 ve 5).

---

## 1. Role — Yönetim Modeli

Sistemde iki ayrı panel vardır:

### Admin paneli
- **Tam bir yönetim panelidir**: kod değişikliği/deploy gerekmeden runtime'da
  veri yönetimi yapılır. Admin panelden yapılabilenler:
  - Etkinlik oluşturma/düzenleme (isim, açıklama vb.).
  - Her etkinlik için gün/saat kombinasyonları ve her kombinasyonun
    kontenjan sayısını (20–60 arası, bkz. Bölüm 3) tanımlama/düzenleme.
  - Kazanan listesini **Excel** dosyası olarak yükleme (Ad Soyad + giriş
    numarası birlikte — bkz. Bölüm 3, "Excel veri aktarımı").
  - Etkinliğin **PDF** biletini yükleme (etkinlik başına tek dosya, tekrar
    yüklenirse üzerine yazılır).
- **Erişim modeli:** Admin panelinin kullanıcı adı/şifre girişi **yoktur**.
  Erişim tamamen gizli, tahmin edilemesi çok zor bir URL'ye (ör. rastgele
  uzun bir path/token) dayanır — "security through obscurity". Bu, proje
  sahibinin bilinçli tercihidir: tek kişi tarafından yönetildiği için ekstra
  bir login akışı gereksiz görülmüştür. Bkz. Bölüm 5 için bu modelin
  getirdiği ek kurallar (URL'nin sızmaması için alınması gereken önlemler).
- Proje sahibi (admin) tek kişidir; çoklu admin hesabı/rol ayrımı yoktur.

### Kullanıcı paneli
- Kazananların giriş numarasıyla erişip slot seçip bilet indirdiği taraf.
- Kimlik doğrulama/hesap **yoktur** (bkz. Bölüm 5); tek kullanılan mekanizma
  giriş numarasıdır.

## 2. Task & Format — Ürün Akışı

Uçtan uca akış:

**Admin tarafı:**

1. **Anket/çekiliş** başka bir platformda yapılır (bu sistemin kapsamı dışında).
2. Admin, gizli admin paneli URL'sinden panele girer.
3. Admin, panelden etkinliği (ve varsa gün/saat kombinasyonları ile
   kontenjan sayılarını) oluşturur/düzenler.
4. Admin, **Ad Soyad + giriş numarası** içeren Excel dosyasını (numaraları
   kendisi üretmiştir) o etkinlik için panelden yükler. Aynı etkinliğe daha
   sonra tekrar Excel yüklenirse, yeni satırlar mevcut listeye **eklenir**
   (append) — bkz. Bölüm 3, "Excel veri aktarımı".
5. Admin, o etkinliğin **PDF** biletini panelden yükler.
6. Giriş numaraları kazananlara admin tarafından, bu sistemin dışında
   (ör. anket platformu/e-posta/SMS) iletilir — bu iletim kanalı kapsam
   dışıdır.

**Kullanıcı tarafı:**

7. Kullanıcı siteye girdiğinde tek alanlı bir **giriş paneli** görür: giriş
   numarasını yazar ve **Enter'a basarak** giriş yapar (ayrı bir "gönder"
   butonuna gerek yoktur, Enter tuşu yeterlidir). Sistem numarayı isimle
   eşleştirir ve kısa bir onay göstergesi (maskeli isim, ör. "Ay Ka") ile
   doğrular.
8. Kullanıcı, ilgili etkinlik için uygun **gün/saat kontenjanlarından**
   birini seçer.
9. Seçim onaylandığında o etkinliğe ait **PDF bilet doğrudan indirilir** ve
   giriş numarası kullanılmış olarak işaretlenir.

## 3. Context & Constraint — Veri Modeli & Kurallar

### Kontenjan
- Etkinlik başına bilet sayısı **20–60** arasında değişir.
- Her **etkinlik × gün × saat** kombinasyonunun kendi ayrı ve sınırlı
  kontenjanı vardır. Bu kombinasyonlar ve kontenjan sayıları **admin
  panelinden** tanımlanır/düzenlenir (bkz. Bölüm 1).
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
- **Netleştirme:** Kullanıcı tarafındaki giriş paneli tek ve genel bir
  alandır (bkz. Bölüm 2, adım 7) — kullanıcı önce bir etkinlik seçmez, önce
  numarasını yazar. Bu yüzden bir giriş numarası **sistem genelinde
  benzersiz** olmalıdır (etkinlik + numara kombinasyonu değil, tek başına
  numara); sistem, numaradan doğrudan tek bir kazanan ve dolayısıyla tek bir
  etkinliğe ulaşır. Aynı kişi farklı etkinliklerde ayrı ayrı kazanan olabilir
  (bkz. yukarıda), ama bu durumda her etkinlik için farklı ve birbirinden
  bağımsız (globalde de benzersiz) bir numara alır.

### Karar süresi (5 dakika kuralı)
- Kullanıcı bir gün/saat seçimini değerlendirmeye (kilitlemeye) başladığında
  **5 dakikalık karar süresi** başlar.
- Bu süre boyunca üzerinde düşünülen slot **kilitli** kabul edilir; başka
  hiçbir kullanıcı bu süre zarfında o slotu görüp seçemez / listede
  kullanılabilir olarak göremez.
- **Netleştirme:** Kilit, o gün/saat kombinasyonunun **tüm kontenjanını değil,
  yalnızca bir birimini** tüketir (bkz. Bölüm 3 "Kontenjan"). Yani aynı anda
  birden fazla farklı kazanan aynı kombinasyon üzerinde kendi 5 dakikalık
  kararını verebilir; kombinasyon yalnızca `kilitli + onaylanmış` toplam
  sayısı kontenjanına ulaştığında herkese "Dolu" görünür. Aksi yorum (kilidin
  tüm kombinasyonu herkese kapatması) kontenjan kavramıyla çelişir.
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
- Kazanan listesi **admin paneli üzerinden Excel yükleme** ile aktarılır:
  proje sahibi, **Ad Soyad ve giriş numarasını birlikte içeren** Excel
  dosyasını hazırlar (numaraları kendisi üretir) ve ilgili etkinlik için
  panelden yükler. **Uygulama giriş numarası üretmez** — numaralar Excel'de
  zaten hazır gelir; sistem bu eşleşmeyi olduğu gibi kaydeder.
- **Tekrar yükleme davranışı — append:** Bir etkinlik için daha önce Excel
  yüklenmişse ve admin aynı etkinliğe yeni bir Excel yüklerse, yeni
  satırlar mevcut listeye **eklenir**; var olan kayıtlar değişmez/silinmez.
  Eğer yeni Excel'de zaten sistemde kayıtlı bir giriş numarası veya
  ad-soyad tekrar ediyorsa, o satır **atlanır** ve admin'e yükleme sonunda
  atlanan satırların bir özeti/listesi gösterilir (sessizce yutulmaz).
- Giriş numaralarının kazananlara nasıl iletileceği (e-posta, SMS, anket
  platformu vb.) bu sistemin kapsamı dışındadır.

## 4. Style & Tone — Tasarım Referansı

- Görsel ilham kaynağı: **İKSV (İstanbul Kültür Sanat Vakfı)** web sitesi.
- Sade, zarif, kültür/sanat odaklı bir tasarım dili; yoğun beyaz alan
  kullanımı; tipografinin öne çıktığı, dekoratif öğelerin minimize edildiği
  bir görsel yaklaşım.
- Marka, logo, renk paleti gibi somut tasarım detayları **admin panelinden
  yönetilmez** (admin paneli yalnızca Bölüm 1'de sayılan veri işlemlerini
  yapar — etkinlik/kontenjan/Excel/PDF); tasarım, `Design.md` ("Sage") ve
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
- **Admin URL gizliliği**: Admin paneli şifre yerine gizli bir URL ile
  korunduğu için (bkz. Bölüm 1), bu URL'nin sızmaması kritik güvenlik
  önlemidir:
  - URL, arama motorları tarafından indekslenmemelidir (`robots.txt` /
    `noindex` meta etiketi).
  - URL, hata mesajlarına, loglara, kullanıcı tarafına giden HTML/JS'e veya
    genel (public) sitemap/kaynak dosyalarına yazılmamalıdır.
  - URL tahmin edilemeyecek kadar uzun/rastgele olmalıdır (ör. UUID
    tabanlı bir path); "admin", "yonetim" gibi tahmin edilebilir kelimeler
    içermemelidir.
  - Bu, şifreli bir login'e eşdeğer bir güvenlik garantisi **değildir**;
    proje sahibi bu riski bilinçli olarak kabul etmiştir (bkz. Bölüm 1).

---

## Revizyon geçmişi

- **v5 — plan.md hazırlığı sırasında netleştirilen iki teknik nokta:**
  Teknik implementasyon planı yazılırken metinde örtük kalan iki nokta
  açıkça netleştirildi (yeni bir ürün kararı değil, mevcut kuralların
  mantıksal sonucu):
  - 5 dakikalık kilit, kombinasyonun **tüm kontenjanını değil bir birimini**
    tüketir (bkz. Bölüm 3, "Karar süresi").
  - Giriş numarası **sistem genelinde benzersizdir** (etkinlik bazlı değil)
    çünkü kullanıcı paneli tek/genel bir giriş alanıdır (bkz. Bölüm 3,
    "Giriş numarası ve isim eşleştirme").
- **v4 — Admin paneli eklendi:** Proje sahibi, v1'deki "admin paneli yoktur,
  her şey kod/dosya seviyesinde statik yönetilir" kararını **geçersiz
  kıldı**. Artık tam bir admin paneli vardır (etkinlik/kontenjan/gün-saat
  yönetimi, Excel yükleme, PDF yükleme — bkz. Bölüm 1 ve 2). Bununla
  birlikte netleşen alt kararlar:
  - Admin paneli erişimi: kullanıcı adı/şifre değil, **gizli/tahmin
    edilemez URL** (bkz. Bölüm 1, 5).
  - Excel'de giriş numaraları hâlâ **admin tarafından üretilip** yüklenir
    (v3'teki karar korundu, sistem numara üretmiyor).
  - Aynı etkinliğe tekrar Excel yüklenirse davranış **append**'tir (yeni
    satırlar eklenir, var olanlar korunur); çakışan (tekrar eden) numara/isim
    satırları atlanır ve admin'e özet gösterilir (bkz. Bölüm 3).
  - Kullanıcı tarafında hâlâ **hiçbir kimlik doğrulama yoktur** — bu
    değişiklik yalnızca admin tarafını etkiler, Bölüm 5'teki "ekstra kimlik
    doğrulama yok" kuralı kullanıcı paneli için geçerliliğini korur.
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
3. Append modunda çakışan (tekrar eden numara/isim) satırların sessizce
   yutulmayıp **atlanıp admin'e özet olarak gösterilmesi** — Bölüm 3,
   "Excel veri aktarımı".
4. Admin URL'sinin sızmasını önleyecek somut önlemler (noindex, log/hata
   mesajlarına yazılmama, tahmin edilemez uzunluk) — Bölüm 5.

## Kapsam dışı (Out of scope)

- Anket/çekiliş sürecinin kendisi (başka platformda yürütülür).
- Kullanıcı hesabı, giriş/kayıt akışı, e-posta/SMS doğrulama (kullanıcı
  tarafı için — admin paneli artık kapsam içindedir, bkz. Bölüm 1).
- Giriş numaralarının kazananlara iletim kanalı (e-posta/SMS/anket platformu).
- Kişiye özel (unique) PDF üretimi — biletler etkinlik başına ortaktır.
- Çoklu admin hesabı/rol yönetimi — tek admin, tek gizli URL yeterlidir.
