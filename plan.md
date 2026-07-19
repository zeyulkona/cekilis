# plan.md — Teknik Uygulama Planı

> Bu belge, `INTENT.md` (ürün/davranış kuralları), `CLAUDE.md` (geliştirme
> rehberi) ve `Design.md` ("Sage" tasarım sistemi) temel alınarak hazırlanmış
> somut, uygulanabilir teknik plandır. Barındırma modeli (tek VPS, tek
> sürekli Node.js süreci) proje sahibi tarafından seçilmiştir. İki teknik
> netleştirme `INTENT.md` v5 revizyonuna işlenmiştir (kilidin kontenjanın bir
> birimini tüketmesi; giriş numarasının sistem genelinde benzersiz olması) —
> bu plan o netleştirmeleri temel alır.

## 1. Stack

**Node.js (LTS 20+) + Express 4 + EJS (server-render) + `better-sqlite3` +
`multer` + `xlsx` (SheetJS). React/Next.js yok, build adımı yok, ORM yok.**

- Neden React/Next.js değil: tek gerçek istemci-tarafı davranış Enter'la
  gönderme (native `<form>`, sıfır JS gerektirir), bir geri sayım halkası ve
  slot listesini tazeleyen basit bir JSON polling. Bunun için build
  pipeline/hydration/router getirmek, `CLAUDE.md`'deki Karpathy ilkesine
  ("sadelik önceliği, istenmeyen esneklik yok") aykırı olur.
- Neden `better-sqlite3`: **senkron** bir sürücü — çağrılar Node event
  loop'unu native SQLite çağrısı dönene kadar bloklar. Bu, atomic slot
  kilidi garantisinin (bkz. Bölüm 3) temelidir; `node-sqlite3` gibi
  async/callback bir sürücü tam olarak önlemeye çalıştığımız
  check-then-act yarış penceresini geri getirir.
- Neden ORM yok: şema 4 tablo; başlangıçta çalışan idempotent bir
  `schema.sql` (`CREATE TABLE IF NOT EXISTS`) yeterli.
- Süreç yönetimi: **systemd** (`Restart=always`) — VPS'te zaten var, ekstra
  bağımlılık yok.
- Test: `node --test` + `node:assert` (DB/kilit birim testleri, `:memory:`
  SQLite ile) + `supertest` (HTTP rota testleri).

## 2. Veri modeli

```
events        (id, name, description, pdf_uploaded_at, created_at, updated_at)

slots         (id, event_id → events, day_label, time_label, quota,
               UNIQUE(event_id, day_label, time_label))
              -- her etkinlik×gün×saat kombinasyonu

winners       (id, event_id → events, full_name, entry_number UNIQUE,
               created_at)
              -- entry_number SİSTEM GENELİNDE benzersiz (bkz. INTENT.md v5)

claims        (id, winner_id → winners, slot_id → slots,
               status ∈ {locked, claimed, expired},
               locked_at, expires_at, claimed_at)
              -- INDEX(slot_id, status, expires_at), INDEX(winner_id)
              -- UNIQUE INDEX ux_claims_active_winner ON claims(winner_id)
              --   WHERE status IN ('locked','claimed')
```

**"Şu an dolu mu?" her zaman canlı hesaplanır**, hiçbir sayaç/`status`
alanına güvenilmez:

```sql
SELECT COUNT(*) FROM claims
WHERE slot_id = ?
  AND (status = 'claimed' OR (status = 'locked' AND expires_at > datetime('now')))
```

Bu tek predicate; kontenjan kontrolü, "Dolu" rozeti ve kapasite sınırının tek
kaynağıdır — `status` kolonuna asla tek başına güvenilmez (5 dakika dolduktan
sonra arka plan süpürme çalışana kadar `status='locked'` kalabilir).

`quota` alanı `CHECK (quota > 0)` ile sınırlanır; INTENT.md'deki "20–60"
aralığı sert bir DB kısıtı değil, admin formunda bir öneri/placeholder'dır
(gerçek dışı bir test etkinliğini engellemesin diye).

## 3. Atomic slot kilidi — nasıl çalışır

**Garanti şu üç katmandan gelir:**
1. `better-sqlite3` senkron çalışır + Node tek JS thread'i + kritik bölümde
   `await` yok → `db.transaction(fn)` içindeki tüm işlem, başka bir isteğin
   JS callback'i çalışmaya başlamadan **tamamen** biter. İki "eşzamanlı" HTTP
   isteği asla gerçekten kesişemez.
2. SQLite'ın kendi tek-yazar modeli (`BEGIN IMMEDIATE`, WAL, `busy_timeout`)
   — (1) bir şekilde ihlal edilirse bile (ör. ileride worker_threads/cluster
   eklenirse) ikinci koruma katmanı.
3. `ux_claims_active_winner` kısmi unique index'i — DB şeması seviyesinde,
   bir kazananın aynı anda birden fazla aktif (locked/claimed) satırı
   olmasını engeller.

**Kilitleme transaction'ı (özet mantık):**
1. Kazananın kendi süresi geçmiş kilidini `expired` olarak işaretle
   (self-heal — partial index zaman farkında olmadığı için gerekli).
2. Kazanan zaten `claimed` ise → "numara kullanılmış" hatası. Zaten
   `locked` ise → mevcut kilit akışına devam (yeniden kilitleme yok).
3. Tek SQL cümlesinde kontenjan kontrolü + insert birlikte:
   ```sql
   INSERT INTO claims (winner_id, slot_id, status, locked_at, expires_at)
   SELECT ?, ?, 'locked', datetime('now'), datetime('now', '+5 minutes')
   WHERE (SELECT COUNT(*) FROM claims WHERE slot_id = ? AND (...canlı dolu...))
         < (SELECT quota FROM slots WHERE id = ?)
   ```
   `changes === 0` → slot dolu, temiz "Dolu" cevabı, hiçbir satır eklenmez.

**Örnek — son koltuk için yarış:** Kontenjan 40, 39 dolu. A ve B aynı anda
istek atar. A'nın transaction'ı önce biter (JS run-to-completion), sayaç 39
okur, `39 < 40`, satır eklenir → 40 doldu. B'nin transaction'ı ancak A
bittikten sonra çalışır, sayaç artık 40 okur, `40 < 40` yanlış, `changes=0`
→ B'ye net "Dolu" cevabı. Okuma ve yazma tek bölünemez SQL ifadesi olduğu
için ikisinin de aynı anda "39" okuduğu bir pencere yoktur.

**Kilit süresi dolumu:** Her sorgu zaman-farkında predicate'i doğrudan
uygular (yukarıdaki SELECT) — doğruluk hiçbir zamanlayıcının tetiklenmesine
bağlı değildir. Buna ek olarak ~60 saniyede bir çalışan bir arka plan görevi
`status='locked' AND expires_at <= now()` olan satırları `expired` yapar;
bu yalnızca kozmetik/temizlik amaçlıdır (ör. admin'in "şu an kim
değerlendiriyor" görünümü için), doğruluk garantisi buna dayanmaz.

## 4. Admin gizli URL mekanizması

- Uzun rastgele bir token (`ADMIN_SECRET_PATH`), `.env` içinde (git'e
  girmez), `app.use('/' + process.env.ADMIN_SECRET_PATH, adminRouter)`.
  Rotasyon: env değiştir + `systemctl restart`.
- **Somut sızıntı önlemleri:**
  - `robots.txt` admin path'ini **hiç anmaz** (Disallow satırı bile sızıntı
    olur); bunun yerine yalnızca admin rotalarında
    `<meta name="robots" content="noindex, nofollow">` + `X-Robots-Tag` header.
  - Log middleware, admin path'iyle başlayan istekleri loglamadan önce
    `/[admin]/***` ile redakte eder.
  - `NODE_ENV=production` + genel hata sayfası; `req.originalUrl`/stack
    trace asla response body'sine yazılmaz.
  - Sitemap hiç üretilmez (sızacak bir sitemap olmasın diye).
  - `Referrer-Policy: no-referrer` site genelinde.
  - Fontlar (Fraunces/Manrope) `/public/fonts` altında self-hosted — admin
    sayfalarından üçüncü taraf CDN isteği (ve dolayısıyla Referer sızıntısı)
    olmaz.
  - Admin JS/form istekleri her zaman relative URL kullanır (secret prefix
    hiçbir paylaşılan/public dosyaya hardcode edilmez).
  - `/admin`, `/yonetim`, `/dashboard` gibi tahmin edilebilir yollar, diğer
    var olmayan rotalarla birebir aynı genel 404'ü döner.

## 5. Excel ve PDF yükleme akışı

**Excel ayrıştırma:** `xlsx` (SheetJS), `multer.memoryStorage()` (dosyalar
küçük, diske yazmaya gerek yok). "Ad Soyad" / "Giriş Numarası" başlıkları
gevşek eşleştirilir (trim + case-insensitive); başlıklar uymuyorsa tüm dosya
en baştan reddedilir.

**Uçtan uca append + çakışma-atlama akışı** (tek `db.transaction()` içinde):
1. Her satır `{full_name, entry_number}` olarak parse edilir.
2. Sırayla: `entry_number` **sistem genelinde** zaten varsa → atla, sebep
   "numara zaten kayıtlı" (hangi etkinlikte kayıtlı olduğu da belirtilir).
   Yoksa, normalize edilmiş `full_name` **bu etkinlikte** zaten varsa → atla,
   sebep "bu etkinlikte isim zaten kayıtlı". Aksi halde ekle.
3. Yükleme sonunda özet: toplam satır, eklenen, atlanan (her atlanan satır +
   sebebiyle birlikte) — hiçbir şey sessizce yutulmaz.
4. Yapısal olarak bozuk dosya (eksik kolon, boş dosya) → 0 satır işlenir,
   mevcut liste korunur, net hata mesajı.

**PDF yükleme:** `multer.diskStorage()` → `uploads/pdfs/event-<id>.pdf`
(deterministik isim, tekrar yükleme = düz üzerine yazma). `fileFilter`
yalnızca `application/pdf`, makul boyut sınırı (ör. 20MB).

**PDF sunumu:** `express.static` değil, özel bir route
(`GET /etkinlik/:id/bilet.pdf`) — etkinlik ve dosya varlığını kontrol edip
`Content-Disposition: attachment` ile `res.sendFile`.

## 6. Design.md ("Sage") entegrasyonu

Otomatik token-pipeline **yok**. `Design.md`'nin YAML frontmatter'ı bir kez
elle okunup `public/css/tokens.css` içine CSS custom property olarak
işlenir (`--color-primary`, `--rounded-full` vb.) + Design.md'deki bileşen
adlarını birebir yansıtan sınıflar (`.button-primary`, `.card-slot`,
`.card-slot-full`, `.badge-winner`, `.timer-ring`, `.confirmation-panel`,
`.input-entry-code`). INTENT.md Bölüm 4 tasarımın admin'den yönetilmediğini
zaten söylüyor — runtime'da yeniden temalandırma ihtiyacı yok, otomatik bir
pipeline gereksiz karmaşıklık olur. Sage'in "sade + hafif gamification"
karakteri (bkz. Design.md Overview/Do's-Don'ts) yalnızca **kullanıcı
tarafına** uygulanır; admin paneli sade/işlevsel kalır, Design.md'nin kendisi
de admin'i kapsam dışı bırakır.

## 7. Fazlı yol haritası

- **Faz 0 — İskelet:** `package.json`, Express iskeleti, `schema.sql`
  boot'ta çalışır, `.env.example`, `.gitignore` (db dosyası, uploads, .env),
  systemd unit. *Test:* uygulama ayağa kalkar, boş giriş formu döner.
- **Faz 1 — Admin CRUD (etkinlik/slot/kontenjan):** Excel/PDF henüz yok.
  *Test:* panelden etkinlik + gün/saat/kontenjan oluşturulur, DB'den
  doğrulanır; `/admin` gibi tahminler genel 404 döner.
- **Faz 2 — Excel import + PDF yükleme.** *Test:* 5 satırlık dosya → 5
  kazanan; aynı dosya tekrar yüklenir → 5 atlama özeti; karışık
  yeni/çakışan satırlar → doğru ayrım; PDF üzerine yazma doğrulanır.
- **Faz 3 — Kullanıcı giriş numarası akışı (slot seçimi hariç).** *Test:*
  geçerli numara doğru maskeli ismi gösterir; geçersiz/var olmayan numara
  aynı genel hatayı verir.
- **Faz 4 — Slot seçimi + atomic kilit + onay + PDF indirme.** Asıl
  eşzamanlılık fazı; geri sayım UI'ı sunucudaki `expires_at`'e bağlanır.
  *Test:* tam mutlu yol + Bölüm 8'deki eşzamanlılık senaryoları.
- **Faz 5 — Sage stilizasyonu.** Üç kritik kullanıcı anına token/bileşen
  sınıfları uygulanır; admin sade kalır. *Test:* Design.md Do's/Don'ts'a
  karşı manuel QA (gölgesiz hover, geri sayımın yalnızca son 60 saniyede
  tertiary→error geçişi, tek seferlik kutlama).
- **Faz 6 — Sağlamlaştırma ve doğrulama:** Admin URL sızıntı taraması
  (her public sayfa/asset/log satırında secret string grep), noindex
  header'ları, referrer-policy, prod hata sayfası, yük altında eşzamanlılık
  testi, basit SQLite dosya yedekleme (cron + `.backup`), secret path
  rotasyonu/restore adımlarını içeren kısa bir README.

## 8. Doğrulama senaryoları

- **Tek kullanımlık numara:** Bir numarayla tam claim tamamla → aynı
  numarayla yeni kilit denemesi reddedilir. Aynı numarayla iki eşzamanlı
  kilit isteği → yalnızca bir claims satırı oluşur (`ux_claims_active_winner`
  garantisi).
- **Atomic kilit/kontenjan:** Kontenjan=1 slotta 20 eşzamanlı istek → sadece
  1 başarılı, 19 "Dolu". Kontenjan=40'ta 39 dolu iken 5 eşzamanlı istek →
  sadece 1 başarılı. Süresi geçmiş ama hâlâ `status='locked'` bir satır
  varken yeni istek → yine de başarılı (canlı predicate'in, `status`
  kolonuna değil zaman farkına dayandığını kanıtlar).
- **Kısmi kilitlerde "Dolu" görünümü:** Kontenjan=5, 4 onaylanmış + 1 kilitli
  (henüz onaylanmamış) = 5 dolu → yeni ziyaretçiye "Dolu" görünür (Bölüm
  3'teki netleştirmeyi doğrular). Kilit süresi geçince slot tekrar açılır.
- **Excel append + çakışma atlama:** İlk 10 satır → 10 kazanan. Yeniden
  yükleme: 3 numara çakışması + 2 isim çakışması + 5 yeni → tam olarak 5
  eklenir, 5 atlanır, her biri doğru sebeple listelenir. Bozuk dosya → 0
  satır işlenir, mevcut liste korunur. Farklı etkinlikte aynı numara →
  atlanır, hangi etkinlikte kayıtlı olduğu belirtilir (global benzersizlik
  doğrulaması).
- **Admin URL gizliliği:** `/robots.txt` secret string içermez; tüm public
  sayfa/asset'lerde grep taraması secret string'e rastlamaz; 404/500
  response body'lerinde `originalUrl`/stack trace yok; `/admin` vb. genel
  404; her admin sayfasında noindex meta/header var; admin isteği loglanınca
  redakte edilmiş path görülür.

## Kritik dosyalar (uygulama başladığında)

- `src/db/schema.sql`
- `src/services/claims.js` (atomic kilit/claim mantığı)
- `src/services/excelImport.js` (append + çakışma-atlama)
- `src/routes/admin.js`
- `src/routes/user.js`
- `public/css/tokens.css` (Design.md'den elle işlenmiş Sage tokenları)
