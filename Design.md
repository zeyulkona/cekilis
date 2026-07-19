---
name: Sage — Etkinlik Bilet Dağıtım Sistemi Tasarım Sistemi
colors:
  background: "#F7F5EF"
  on-background: "#242820"
  surface: "#FFFFFF"
  surface-dim: "#EDEAE0"
  surface-bright: "#FFFFFF"
  surface-container-lowest: "#FFFFFF"
  surface-container-low: "#F4F2E8"
  surface-container: "#EDEAE0"
  surface-container-high: "#E5E1D3"
  surface-container-highest: "#DCD7C5"
  on-surface: "#242820"
  on-surface-variant: "#5B6353"
  inverse-surface: "#33362D"
  inverse-on-surface: "#F5F2E7"
  outline: "#98A28A"
  outline-variant: "#D8DBC8"
  surface-tint: "#6E7F5B"
  primary: "#6E7F5B"
  on-primary: "#FFFFFF"
  primary-container: "#DCE4CB"
  on-primary-container: "#212D14"
  inverse-primary: "#B7C6A0"
  secondary: "#B8874A"
  on-secondary: "#FFFFFF"
  secondary-container: "#F4E3C6"
  on-secondary-container: "#4A340E"
  tertiary: "#B5654A"
  on-tertiary: "#FFFFFF"
  tertiary-container: "#F5DBCF"
  on-tertiary-container: "#4A2414"
  error: "#B3413A"
  on-error: "#FFFFFF"
  error-container: "#F6DAD6"
  on-error-container: "#5C1A14"
typography:
  headline-xl:
    fontFamily: Fraunces
    fontSize: 56px
    fontWeight: "500"
    lineHeight: 62px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 36px
    fontWeight: "500"
    lineHeight: 44px
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Fraunces
    fontSize: 24px
    fontWeight: "500"
    lineHeight: 32px
    letterSpacing: 0em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: 0em
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 20px
    letterSpacing: 0.02em
  entry-code:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: 0.3em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1120px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 80px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 52px
  button-primary-hover:
    backgroundColor: "#5C6C4B"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 52px
    border: "1px solid {colors.outline}"
  input-entry-code:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.entry-code}"
    rounded: "{rounded.md}"
    padding: 20px
    border: "1px solid {colors.outline-variant}"
  input-entry-code-focus:
    border: "2px solid {colors.primary}"
  input-entry-code-error:
    border: "1px solid {colors.error}"
  card-event:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.gutter}"
  card-slot:
    backgroundColor: "{colors.surface-container-low}"
    rounded: "{rounded.md}"
    padding: 16px
  card-slot-hover:
    backgroundColor: "{colors.primary-container}"
  card-slot-full:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
  badge-winner:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-full:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 6px
  timer-ring:
    trackColor: "{colors.outline-variant}"
    fillColor: "{colors.tertiary}"
    fillColorWarning: "{colors.error}"
  confirmation-panel:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.xl}"
    padding: "{spacing.gutter}"
---

## Overview

**Sage**, bu etkinlik bilet dağıtım sisteminin tasarım dilidir. Görsel ilham
kaynağı İKSV (İstanbul Kültür Sanat Vakfı) — sade, zarif, kültür/sanat
odaklı, yoğun beyaz alan kullanan, tipografinin öne çıktığı bir dil (bkz.
`INTENT.md` Bölüm 4). Sage bunu tek bir eksende genişletir: **kolaylık +
hafif oyunlaştırma**. Arayüz hiçbir yerde "oyun" gibi hissettirmemeli;
sadece kullanıcının kritik anlarda (giriş numarası doğrulama, 5 dakikalık
karar süresi, bilet indirme) net ve tatmin edici bir geri bildirim alması
sağlanmalı. Sakinlik varsayılan durumdur, coşku yalnızca kazanımın
onaylandığı anlarda ortaya çıkar.

Sistemin doğası gereği (bkz. `INTENT.md`) tasarım üç kritik anı taşımak
zorundadır: **giriş numarası girişi**, **slot seçimi + 5 dakikalık kilit**,
ve **bilet onayı/indirme**. Sage'in tüm görsel kararları bu üç anı
kolaylaştırmak ve duygusal olarak ödüllendirmek için vardır.

## Colors

Sage paleti, adaçayı yeşilinin sakinliğini sıcak krem bir zemin üzerine
oturtur; oyunlaştırma anları için amber (ödül) ve toprak tonu turuncu
(aciliyet/geri sayım) vurgular eklenir.

- **Primary (Sage Green — `{colors.primary}`):** Ana marka rengi. Butonlar,
  seçili slot vurguları, onay panelleri. Sakin ve güvenilir.
- **Secondary (Warm Amber — `{colors.secondary}`):** Yalnızca **kazanım/ödül
  anlarında** kullanılır — "Kazandınız" rozeti, bilet onay ekranı, başarılı
  indirme sonrası vurgu. Bu renk gördüğü her yerde kullanıcıya "bir şeyi
  başardın" hissi vermelidir; rastgele dekoratif kullanımdan kaçınılmalı.
- **Tertiary (Warm Terracotta — `{colors.tertiary}`):** Yalnızca **5 dakikalık
  geri sayım** göstergesinde kullanılır (bkz. `timer-ring` bileşeni). Süre
  azaldıkça `tertiary`'den `error`'a geçiş yapar — bu, oyunlaştırılmış tek
  gerilim anıdır ve kullanıcıyı bilgilendirir, panikletmez.
- **Error (Muted Red):** Yalnızca gerçek hata/kısıt durumlarında: dolu
  kontenjan, geçersiz giriş numarası, süresi dolmuş kilit.
- **Neutral (Warm Cream/Charcoal):** Zemin ve metin. Beyaz alan İKSV
  referansı gereği bilinçli ve boldur; dekoratif öğeler asgaride tutulur.

Kural: **Amber ve terracotta, kullanıcının duygusal durumuna karşılık gelen
tek renklerdir** — biri ödül, biri gerilim/geri sayım. Bunların dışında
başka bir yerde "oyunlaştırma rengi" icat edilmemelidir; aksi halde sistem
gerçekte olduğundan daha "oyunsu" görünür ve İKSV referansıyla çelişir.

## Typography

İkili yazı tipi stratejisi, editoryal zarafeti günlük kullanım kolaylığıyla
dengeler:

- **Fraunces** (serif, `headline-*`): Etkinlik adları, sayfa başlıkları,
  onay ekranı başlığı ("Biletiniz Hazır!"). Karakteri güçlü, kültürel/sanat
  odaklı bir ton verir — İKSV referansının tipografik omurgasıdır.
- **Manrope** (sans, `body-*`, `label-*`): Gövde metni, butonlar, form
  etiketleri. Yuvarlak, dost canlısı harfleri "kolaylık" hissini taşır;
  kullanıcı hiçbir noktada karmaşık/resmi bir arayüzle karşılaşmamalıdır.
- **`entry-code`** (özel token): Giriş numarası input alanına özeldir.
  Büyük punto (32px), geniş harf aralığı (0.3em) ve kalın ağırlık — bir
  banka kartı/PIN girişi gibi değil, aksine **davetkâr ve okunaklı** bir
  "kodunu gir" hissi verir. Bu, sistemin tek zorunlu etkileşim noktası
  olduğu için en yüksek okunabilirlik önceliğine sahiptir.

## Layout

Zemin felsefesi **"nefes alan editoryal grid"**dir: İKSV'nin yoğun beyaz
alan kullanımından ilham alır, ama üç kritik akış adımını (giriş → seçim →
onay) her zaman ekranın tek ve net odağı olarak tutar.

- Masaüstünde `{spacing.container-max}` (1120px) genişliğinde, ortalanmış
  tek sütunlu bir akış tercih edilir — kullanıcı asla "hangi bölüme
  bakmalıyım" sorusuyla karşılaşmamalıdır. Bu, kolaylık hedefinin doğrudan
  sonucudur.
- Giriş numarası ekranı **tam ekran, tek odaklı** bir kart olarak
  tasarlanır: sadece `input-entry-code` ve tek bir birincil buton (veya
  Enter'a basma talimatı) görünür (bkz. `INTENT.md` Bölüm 2, adım 4).
- Slot seçim ekranı, `card-slot` bileşenlerinin bir ızgarasıdır; dolu
  slotlar (`card-slot-full`) görsel olarak geri çekilir (düşük kontrast,
  rozet), boş slotlar öne çıkar.
- Dış kenar boşlukları geniş tutulur (`{spacing.margin-desktop}` = 80px)
  — İKSV'nin "nefes alan" beyaz alan ilkesi burada karar yorgunluğunu
  azaltan bir kolaylık aracına dönüşür.

## Elevation & Depth

Derinlik minimal ve amaca yöneliktir; dekoratif gölge kullanılmaz.

- **Seviye 1 (Zemin):** Düz krem arka plan, gölgesiz.
- **Seviye 2 (Kartlar):** `card-event` ve `card-slot` çok hafif bir
  yükselti alır (ince, düşük opasiteli gölge) — sadece "bu tıklanabilir"
  sinyalini vermek için, dramatik bir derinlik hissi için değil.
  Hover durumunda kart, gölge yerine `primary-container` dolgusuna geçer;
  bu, oyunlaştırma dokunuşunun temelidir: **etkileşim, gölge yerine renk
  ve hafif ölçek değişimiyle (scale 1.0 → 1.02) kutlanır.**
- **Seviye 3 (Onay/kutlama):** `confirmation-panel` ve `badge-winner`,
  belirgin biçimde öne çıkan tek yükseltili yüzeylerdir — sistemde
  "ödül anı" olarak tasarlanan tek yerlerdir.

## Shapes

Şekil dili **"yumuşak-editoryal"**dır: köşeler İKSV'nin ciddiyetini
bozmayacak kadar hafif yuvarlatılmış, ama oyunlaştırma bileşenlerinde
(rozetler, birincil buton, geri sayım halkası) tam yuvarlak (`rounded.full`)
kullanılarak "ödül/oyun" hissi taşınır.

- Kartlar ve input alanları: `rounded.md`–`rounded.lg` (12–16px) — ciddi,
  editoryal.
- Butonlar ve rozetler (`badge-winner`, `badge-full`): `rounded.full` —
  hap şeklinde, sıcak ve davetkâr; bu, "gamification" dokunuşunun şekil
  düzeyindeki karşılığıdır.
- Geri sayım göstergesi (`timer-ring`) dairesel bir halka olarak
  tasarlanır — ilerleme çemberi, azalan bir "hayat çubuğu" gibi değil
  sakin bir saat gibi okunur.

## Components

### Giriş numarası paneli

`input-entry-code` tek başına ekranın odağıdır. Kullanıcı numarayı yazar
ve **Enter'a basarak** gönderir (bkz. `INTENT.md` Bölüm 2). Doğru numarada
kart yumuşak bir geçişle maskeli isme (`headline-md`, Fraunces) döner —
bu ilk "doğrulandın" anıdır ve `primary-container` rengiyle hafifçe
vurgulanır. Hatalı numarada `input-entry-code-error` border'ı ve genel,
bilgi sızdırmayan bir hata mesajı gösterilir (bkz. `INTENT.md` Bölüm 5).

### Slot kartları ve geri sayım

`card-slot`, seçilebilir gün/saat kombinasyonlarını gösterir. Bir slot
değerlendirilmeye başlandığında (5 dakikalık kilit başlar), kart üzerinde
`timer-ring` belirir: `tertiary` renginde başlar, son 60 saniyede `error`
rengine geçer. Bu geçiş, kullanıcıya baskı yapmadan aciliyeti iletir —
oyunlaştırmanın tek "gerilim" bileşenidir ve asla agresif animasyon
(titreme, kırmızı yanıp sönme) içermez. `card-slot-full`, düşük kontrast
ve `badge-full` ("Dolu") ile açıkça ve yanıltmadan işaretlenir.

### Onay ve kutlama

Seçim tamamlanıp PDF indirildiğinde `confirmation-panel` belirir:
`badge-winner` rozeti, `headline-lg` ("Biletiniz Hazır!") ve amber vurgulu
bir indirme onayı. Bu, sistemdeki **tek belirgin kutlama anıdır** — konfeti
veya benzeri bir mikro-animasyon yalnızca burada, tek seferlik ve ölçülü
biçimde (1–2 saniye) kullanılabilir. Sayfanın geri kalanında hareket asgari
tutulur.

### Butonlar ve girişler

`button-primary` (dolu sage) birincil eylemler için (numara gönder, slotu
onayla); `button-secondary` (outline) ikincil eylemler için (geri dön,
başka slot seç). İkisi de `rounded.full` — sistemdeki tüm etkileşilebilir
uçların tutarlı biçimde "davetkâr/oyunsu" hissetmesi için.

## Do's and Don'ts

**Yap:**
- Amber (`secondary`) rengini yalnızca gerçek bir kazanım/onay anında
  kullan.
- Geri sayımı (`timer-ring`) sakin bir renk geçişiyle ilet, asla yanıp
  sönme veya titreşimle değil.
- Beyaz alanı İKSV referansı gereği cömert tut; her ekranda tek net odak
  noktası olsun.
- Giriş numarası alanını her zaman ekranın tartışmasız tek odağı yap.

**Yapma:**
- Oyunlaştırmayı puan, seviye, liderlik tablosu gibi mekaniklere genişletme
  — bu sistemin kapsamı ve `INTENT.md`'nin sade/zarif tonuyla çelişir.
  Gamification burada yalnızca **geri bildirim netliği ve kutlama anı**
  anlamına gelir.
- Dolu (`card-slot-full`) veya hatalı giriş durumlarını eğlenceli/oyunsu
  bir dille sunma — bu durumlar her zaman net ve ciddi kalmalıdır.
- Kart hover'larında gölge biriktirme; derinlik yerine renk/ölçek geçişini
  kullan.
- Sage paleti dışında yeni bir "vurgu rengi" icat etme; amber = ödül,
  terracotta/error = aciliyet/kısıt dışında üçüncü bir anlam yükleme.
