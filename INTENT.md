# INTENT.md — Etkinlik Bilet Dağıtım Sistemi

> Bu belge, projenin ürün ve davranış niyetini tanımlar. Çerçeve: **RTCS-G**
> (Role · Task&Format · Context&Constraint · Style&Tone · Guardrail).
> Uygulama kararları verilirken bu belge referans alınır; belirsiz bir durumda
> buradaki kurallar önceliklidir.

## Özet

Bir anket/çekiliş başka bir platformda yapılır. Kazananların isim listesi bu
siteye statik olarak yüklenir. Site, kazananların isimlerini **maskeli**
gösterir; kazanan kendini listede bulur, bir etkinlik/gün/saat seçer ve
seçim sonrasında PDF bileti anında indirir. Sistemde admin paneli, kullanıcı
hesabı veya kimlik doğrulama yoktur — tüm veri yönetimi (etkinlik, kontenjan,
kazanan listesi, PDF) geliştirici tarafından kod/dosya seviyesinde yapılır.

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
2. Kazananların **Ad Soyad listesi** Excel dosyası olarak geliştiriciye iletilir;
   geliştirici bu veriyi sisteme statik olarak işler (bkz. Bölüm 1).
3. Site, her etkinlik için **kendi kazanan listesini ayrı ayrı** gösterir
   (etkinlik bazlı listeler — bkz. Bölüm 3, "Liste yapısı").
4. Kullanıcı bir etkinliğin maskeli kazanan listesinde **kendi ismini bulur**
   ve seçer.
5. Kullanıcı, o etkinlik için uygun **gün/saat kontenjanlarından** birini seçer.
6. Seçim onaylandığında o etkinliğe ait **PDF bilet doğrudan indirilir**.

## 3. Context & Constraint — Veri Modeli & Kurallar

### Kontenjan
- Etkinlik başına bilet sayısı **20–60** arasında değişir.
- Her **etkinlik × gün × saat** kombinasyonunun kendi ayrı ve sınırlı
  kontenjanı vardır.
- Kontenjan dolan bir kombinasyon **arayüzde net biçimde "Dolu"** olarak
  işaretlenir ve seçilemez hale gelir.

### Liste yapısı ve maskeleme
- Kazanan listesi **etkinlik bazlı** tutulur: bir kişi farklı etkinliklerde
  ayrı ayrı kazanan olarak listelenebilir; her etkinlikte kendi bağımsız
  1-seçim hakkını kullanır.
- İsimler arayüzde maskeli gösterilir: adın ve soyadın **ilk ikişer harfi**
  (ör. "Ay Ka").
- **Maske çakışması:** Aynı etkinlik listesinde birden fazla kişinin maskesi
  aynı çıkarsa (ör. iki "Ahmet Yılmaz" → ikisi de "Ah Yı"), arayüzde
  otomatik bir ayırt edici gösterilir: **"Ah Yı (1)", "Ah Yı (2)"** gibi
  sıra numarası eklenir. Bu, yanlış kişinin bileti almasını önlemek için
  zorunludur ve veri yükleme aşamasında otomatik tespit edilir.

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
- **Zorunlu kural:** Bir isim (liste satırı) yalnızca **bir kez** bilet
  seçimi için kullanılabilir; başarılı bir seçimden sonra o isim listede
  **"kullanıldı" / pasif** olarak işaretlenir ve bir daha seçilemez. Bu,
  sunucu tarafında otoriter (authoritative) kural olarak uygulanır.
- **Ek önlem:** Sistemde kullanıcı hesabı/kimlik doğrulaması olmadığından,
  bu kural yalnızca isim satırı bazında %100 garanti edilebilir. Buna ek
  olarak, bir cihaz/tarayıcının (localStorage/cookie ile) art arda birden
  fazla farklı isim seçmesini zorlaştırmak için **tarayıcı bazlı bir
  ikincil kısıt** uygulanır (ör. bir tarayıcıda başarılı seçim sonrası
  yeni bir seçim denemesi engellenir/uyarılır). Bu ikincil önlem kesin
  değildir (farklı cihaz/gizli sekme ile aşılabilir), amacı yalnızca kaza
  sonucu / niyetsiz ikinci seçimleri azaltmaktır; asıl garanti isim satırı
  kilididir.

### PDF biletler
- PDF biletler **etkinliğe özeldir, kişiye özel değildir**: bir etkinliği
  seçen herkes aynı PDF dosyasını indirir. Etkinlik başına tek bir PDF
  bulunur (gün/saat'e göre farklılaşmaz).

### Excel veri aktarımı
- Kazanan listesi **statik/geliştirici eliyle** aktarılır: kullanıcı Excel
  dosyasını geliştiriciye iletir, geliştirici veriyi işleyip deploy eder.
  Ayrı bir "dosya yükleme" arayüzü/endpoint'i **yoktur** — bu, admin
  paneli olmaması ilkesiyle tutarlıdır.

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
  girişi istenmez.
- **Tek zorunlu kural**: bir isim/kişi birden fazla seçim yapamaz
  (bkz. Bölüm 3, "Tekillik kuralı").
- **Race condition koruması**: bir slot seçilip kilitlendiğinde, o slot
  eşzamanlı olarak başka bir kullanıcı tarafından görülüp seçilemez
  (sunucu tarafında atomik kilitleme gereklidir).
- **Kontenjan görünürlüğü**: dolu kombinasyonlar arayüzde açıkça ve
  yanıltmayacak şekilde "Dolu" olarak işaretlenir.

---

## Bu belgede geliştirici tarafından alınan kararlar

Aşağıdaki noktalar proje sahibi tarafından "kendin karar ver" denilerek
geliştiriciye bırakılmıştır; yukarıdaki ilgili bölümlere işlenmiştir:

1. **Tekillik kontrolü mekanizması**: İsim satırı kilidi (otoriter) +
   tarayıcı bazlı ikincil kısıt (kesin değil, ek önlem) — Bölüm 3.
2. **Maske çakışması**: Çakışan maskelere otomatik sıra numarası eklenir
   (ör. "Ah Yı (1)", "Ah Yı (2)") — Bölüm 3.

## Kapsam dışı (Out of scope)

- Anket/çekiliş sürecinin kendisi (başka platformda yürütülür).
- Kullanıcı hesabı, giriş/kayıt akışı, e-posta/SMS doğrulama.
- Admin paneli veya herhangi bir runtime veri yönetim arayüzü.
- Kişiye özel (unique) PDF üretimi — biletler etkinlik başına ortaktır.
