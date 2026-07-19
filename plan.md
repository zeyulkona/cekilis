# plan.md — Teknik Uygulama Planı

> Bu belge, `INTENT.md` (ürün/davranış kuralları), `CLAUDE.md` (geliştirme
> rehberi) ve `Design.md` ("Sage" tasarım sistemi) temel alınarak hazırlanmış
> somut, uygulanabilir teknik plandır. İki teknik netleştirme `INTENT.md` v5
> revizyonuna işlenmiştir (kilidin kontenjanın bir birimini tüketmesi; giriş
> numarasının sistem genelinde benzersiz olması) — bu plan o netleştirmeleri
> temel alır.

## Revizyon: Vercel mimarisine geçiş

Uygulama önce bu belgenin ilk sürümündeki karara göre (tek VPS, tek sürekli
Node.js süreci, `better-sqlite3`, yerel disk) inşa edildi ve uçtan uca
doğrulandı. Proje sahibi ardından uygulamayı **Vercel**'e deploy etti; bu,
serverless bir çalışma modelidir ve VPS varsayımlarıyla temelden çelişir:
kalıcı yerel disk yok, tek sürekli süreç yok, ve en önemlisi — eşzamanlı
istekler **gerçekten paralel, ayrı process'ler** olarak çalışır. Bu son
nokta kritiktir: önceki tasarımın atomic kilit garantisi "tek Node.js
thread'i + kritik bölümde `await` yok" ilkesine dayanıyordu; Vercel'de bu
öncül tamamen geçersizdir. Bu yüzden aşağıdaki bölümler (1, 3, 4, 5)
**Vercel'e göre yeniden yazıldı** ve kod buna göre güncellendi:

- **Veritabanı:** `better-sqlite3` → Postgres (`pg`), Vercel'in Postgres/Neon
  depolama entegrasyonu üzerinden. Atomic kilit artık gerçek bir Postgres
  satır kilidine (`SELECT ... FOR UPDATE`) dayanıyor — bkz. Bölüm 3.
- **Dosya depolama:** yerel disk (`uploads/pdfs/`) → Vercel Blob
  (`@vercel/blob`). PDF'ler bir blob URL'i olarak saklanır, indirme bu
  URL'e yönlendirme ile yapılır.
- **Giriş noktası:** `server.js`'teki `app.listen()` → `src/app.js`
  (Express app tanımı, `listen` yok) + `api/index.js` (Vercel serverless
  handler, app'i olduğu gibi export eder) + `vercel.json` (tüm path'leri
  tek fonksiyona yönlendiren rewrite). `server.js` yalnızca yerel
  geliştirme için `src/app.js`'i `listen` ile sarar.
- **Arka plan süpürme kaldırıldı:** `setInterval` tabanlı kilit temizliği
  serverless'te anlamsız (süreç kalıcı değil); doğruluk zaten süpürmeye
  bağlı değildi (her okuma zaman-farkında predicate kullanıyor), bu yüzden
  fonksiyon korunup çağrılması kaldırıldı. İstenirse bir Vercel Cron Job ile
  periyodik olarak tetiklenebilir (henüz kurulmadı).
- **Rate limiting notu:** `express-rate-limit`'in bellek içi sayacı, her
  serverless instance'ta ayrı tutulur — VPS'teki gibi tek süreç genelinde
  kesin bir üst sınır artık garanti değildir, düşük trafik için "best
  effort" bir önlem olarak kaldı. Kesin bir sınır isteniyorsa sayaç
  Postgres'e taşınmalı (şu an yapılmadı).

## 1. Stack

**Node.js (LTS 20+) + Express 4 + EJS (server-render) + `pg` (Postgres) +
`@vercel/blob` + `multer` + `xlsx` (SheetJS). React/Next.js yok, build adımı
yok, ORM yok. Vercel serverless olarak deploy edilir.**

- Neden React/Next.js değil: tek gerçek istemci-tarafı davranış Enter'la
  gönderme (native `<form>`, sıfır JS gerektirir), bir geri sayım halkası ve
  slot listesini tazeleyen basit bir JSON polling. Bunun için build
  pipeline/hydration/router getirmek, `CLAUDE.md`'deki Karpathy ilkesine
  ("sadelik önceliği, istenmeyen esneklik yok") aykırı olur. Express app'i
  Vercel'de tek bir serverless fonksiyon (`api/index.js`) olarak çalışır.
- Neden Postgres (VPS/SQLite yerine): Vercel serverless'te kalıcı yerel
  disk yok ve istekler gerçekten paralel process'ler olarak çalışır — tek
  JS thread'ine dayanan bir kilit garantisi burada geçersizdir. Postgres
  gerçek transaction/satır kilidi sunar (bkz. Bölüm 3). `pg` (node-postgres)
  kullanılır; Vercel'in Postgres/Neon depolama entegrasyonu `POSTGRES_URL`'i
  otomatik sağlar.
- Neden `@vercel/blob`: PDF/Excel dosyaları için kalıcı depolama gerekir;
  serverless fonksiyonların yerel diski kalıcı değildir. Blob, Vercel'in
  kendi entegre nesne depolama servisidir, tek satırlık `put()`/`del()` API'i
  vardır.
- Neden ORM yok: şema 4 tablo; başlangıçta çalışan idempotent bir
  `schema.sql` (`CREATE TABLE IF NOT EXISTS`) yeterli, cold start'ta bir kez
  çalışır.
- Test: `node --test --test-concurrency=1` + `node:assert` — gerçek bir
  Postgres'e karşı (yerelde ayrı bir `..._test` veritabanı; testler
  paylaşılan tablo state'i nedeniyle seri çalıştırılır, `TRUNCATE ...
  RESTART IDENTITY CASCADE` ile her testten önce sıfırlanır).

## 2. Veri modeli

```
events        (id, name, description, pdf_url, pdf_uploaded_at,
               created_at, updated_at)
              -- pdf_url: Vercel Blob'daki dosyanın herkese açık URL'i

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
WHERE slot_id = $1
  AND (status = 'claimed' OR (status = 'locked' AND expires_at > now()))
```

Bu tek predicate; kontenjan kontrolü, "Dolu" rozeti ve kapasite sınırının tek
kaynağıdır — `status` kolonuna asla tek başına güvenilmez (5 dakika dolduktan
sonra arka plan süpürme çalışana kadar `status='locked'` kalabilir).

`quota` alanı `CHECK (quota > 0)` ile sınırlanır; INTENT.md'deki "20–60"
aralığı sert bir DB kısıtı değil, admin formunda bir öneri/placeholder'dır
(gerçek dışı bir test etkinliğini engellemesin diye).

## 3. Atomic slot kilidi — nasıl çalışır

Vercel serverless invocation'ları gerçekten ayrı process'ler olarak paralel
çalışır — burada güvenilecek tek bir JS thread'i yoktur (VPS'teki tek-süreç
tasarımının aksine). Doğruluk artık gerçek bir **Postgres satır kilidine**
dayanıyor:

**Garanti şu katmanlardan gelir:**
1. **`SELECT id FROM slots WHERE id = $1 FOR UPDATE`** — transaction'ın ilk
   adımı olarak slot satırını kilitler. Aynı slot için yarışan başka bir
   transaction, bu satırın kilidi bırakılana (commit/rollback) kadar
   bloklanır — bu, kontenjan kontrolü + insert'in neden yarışamayacağının
   temelidir.
2. `ux_claims_active_winner` kısmi unique index'i — DB şeması seviyesinde,
   bir kazananın aynı anda birden fazla aktif (locked/claimed) satırı
   olmasını engeller. Bu, **farklı** slotlar için yarışan aynı kazananı
   yakalar (slot satır kilidi bunu kapsamaz, çünkü iki farklı satır kilitli
   olur) — kod, bu unique constraint ihlalini (`code 23505`) yakalayıp
   temiz bir `AlreadyLockedError`'a çevirir.

**Kilitleme transaction'ı (özet mantık, `db.withTransaction` içinde):**
1. `SELECT id FROM slots WHERE id = $1 FOR UPDATE` — slotu kilitle.
2. Kazananın kendi süresi geçmiş kilidini `expired` olarak işaretle
   (self-heal — partial index zaman farkında olmadığı için gerekli).
3. Kazanan zaten `claimed` ise → "numara kullanılmış" hatası. Zaten
   `locked` ise → mevcut kilit akışına devam (yeniden kilitleme yok).
4. Canlı doluluk sayısını oku, kontenjanla karşılaştır; doluysa
   `SlotFullError`. Değilse `INSERT ... RETURNING *` ile kilidi oluştur.

**Örnek — son koltuk için yarış:** Kontenjan 40, 39 dolu. A ve B aynı anda
istek atar. İkisi de aynı slot satırını `FOR UPDATE` ile kilitlemeye
çalışır; Postgres bunlardan birini (A) önce geçirir, diğerini (B) A'nın
transaction'ı commit/rollback olana kadar bekletir. A'nın transaction'ı
sayaç 39 okur, `39 < 40`, satır ekler, commit → 40 doldu. Ancak o zaman B'nin
bekleyen transaction'ı devam eder, sayaç artık 40 okur, `40 < 40` yanlış →
`SlotFullError`. Okuma ve yazma aynı transaction içinde, slot satırının
kilidi altında olduğu için ikisinin de aynı anda "39" okuduğu bir pencere
yoktur — bu, `test/claims.test.js`'teki 20 eşzamanlı gerçek Postgres
transaction'ıyla doğrulanmıştır (bkz. Bölüm 8).

**Kilit süresi dolumu:** Her sorgu zaman-farkında predicate'i doğrudan
uygular — doğruluk hiçbir zamanlayıcının tetiklenmesine bağlı değildir.
Serverless'te kalıcı bir arka plan süreci olmadığı için `setInterval`
tabanlı süpürme kaldırıldı; `sweepExpiredLocks()` fonksiyonu hâlâ export
edilir ve istenirse bir Vercel Cron Job ile periyodik tetiklenebilir, ama bu
yalnızca kozmetiktir (satır hijyeni), doğruluk garantisine dahil değildir.

## 4. Admin gizli URL mekanizması

- Uzun rastgele bir token (`ADMIN_SECRET_PATH`), Vercel proje ayarlarında
  bir environment variable olarak (git'e asla girmez — yerelde `.env`,
  `.gitignore`'da), `app.use('/' + process.env.ADMIN_SECRET_PATH,
  adminRouter)`. Rotasyon: Vercel dashboard'da env değerini değiştir +
  yeniden deploy et (env değişikliği otomatik yeni bir deploy tetikler).
- **Somut sızıntı önlemleri** (VPS planındakiyle aynı, kod seviyesinde
  hosting modelinden bağımsız):
  - `robots.txt` admin path'ini **hiç anmaz**; bunun yerine yalnızca admin
    rotalarında `<meta name="robots" content="noindex, nofollow">` +
    `X-Robots-Tag` header.
  - Log middleware, admin path'iyle başlayan istekleri loglamadan önce
    `/[admin]/***` ile redakte eder (Vercel'in kendi fonksiyon loglarına da
    aynı redakte edilmiş satır düşer).
  - Genel hata sayfası; `req.originalUrl`/stack trace asla response
    body'sine yazılmaz.
  - Sitemap hiç üretilmez.
  - Admin JS/form istekleri her zaman relative URL kullanır.
  - `/admin`, `/yonetim`, `/dashboard` gibi tahmin edilebilir yollar, diğer
    var olmayan rotalarla birebir aynı genel 404'ü döner.
  - `Referrer-Policy: no-referrer` site genelinde.
  - *Henüz eklenmedi:* Fraunces/Manrope fontlarının self-host edilmesi —
    şu an tarayıcı fallback fontları kullanılıyor, üçüncü taraf font CDN'i
    hiç çağrılmıyor (dolayısıyla bir Referer sızıntısı da yok), ama Sage
    tasarımının tam tipografi hedefine henüz ulaşılmadı.

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

**PDF yükleme:** `multer.memoryStorage()` ile buffer'a alınır, ardından
`@vercel/blob`'un `put()` fonksiyonuyla deterministik bir pathname'e
(`tickets/event-<id>.pdf`, `allowOverwrite: true`) yüklenir — tekrar
yükleme aynı pathname'i overwrite eder. Dönen `url`, `events.pdf_url`
kolonuna kaydedilir. `fileFilter` yalnızca `application/pdf`, makul boyut
sınırı (20MB). Yükleme çağrısı 15 saniyelik bir `AbortController` zaman
aşımıyla sarılır — kötü/eksik `BLOB_READ_WRITE_TOKEN` veya ağ sorunu
isteği sonsuza kadar askıda bırakmak yerine net bir hatayla başarısız olur
(bu, gerçek (geçersiz) bir token'la test edilerek doğrulandı).

**PDF sunumu:** `GET /etkinlik/:id/bilet.pdf` — etkinliği ve `pdf_url`'in
dolu olduğunu kontrol edip blob URL'ine `302` yönlendirme yapar (dosyayı
kendi sunucumuzdan proxy'lemeye gerek yok, blob zaten `access: 'public'`).

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

> Faz 0–6, VPS/SQLite mimarisiyle uygulandı ve doğrulandı; ardından
> yukarıdaki Vercel revizyonuna göre (Postgres + Blob + serverless giriş
> noktası) tüm servis/route katmanı yeniden yazıldı ve aynı senaryolarla
> tekrar doğrulandı (bkz. Bölüm 8). Aşağıdaki fazlar orijinal planı
> yansıtır; Blob yükleme adımı gerçek bir `BLOB_READ_WRITE_TOKEN` olmadan
> bu ortamda test edilemedi (15 saniyede net bir zaman aşımı hatasıyla
> başarısız olduğu doğrulandı) — deploy sonrası gerçek bir PDF yükleyerek
> ayrıca doğrulanmalı.

- **Faz 0 — İskelet:** `package.json`, Express iskeleti, `schema.sql`
  boot'ta çalışır (Postgres), `.env.example`, `.gitignore` (`.env`),
  `vercel.json`. *Test:* uygulama ayağa kalkar, boş giriş formu döner.
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
- **Atomic kilit/kontenjan:** Kontenjan=1 slotta 20 **gerçekten eşzamanlı**
  Postgres transaction'ı (`Promise.all`, `test/claims.test.js`) → sadece 1
  başarılı, 19 `SlotFullError`, `claims` tablosunda tam olarak 1 satır. Aynı
  senaryo gerçek HTTP istekleriyle de (20 paralel `fetch`) doğrulandı.
  Süresi geçmiş ama hâlâ `status='locked'` bir satır varken yeni istek →
  yine de başarılı (canlı predicate'in, `status` kolonuna değil zaman
  farkına dayandığını kanıtlar, arka plan süpürme çalışmadan).
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

## Kritik dosyalar

- `src/db/schema.sql`, `src/db/index.js` (Postgres pool + `withTransaction`)
- `src/services/claims.js` (atomic kilit/claim mantığı — `FOR UPDATE`)
- `src/services/excelImport.js` (append + çakışma-atlama)
- `src/services/blobStorage.js` (PDF yükleme, zaman aşımı korumalı)
- `src/routes/admin.js`, `src/routes/user.js`
- `src/app.js` (Express app tanımı) + `api/index.js` (Vercel handler) +
  `vercel.json` (rewrite) + `server.js` (yerel `listen`)
- `public/css/tokens.css` (Design.md'den elle işlenmiş Sage tokenları)

## Deploy kontrol listesi (Vercel)

1. Vercel projesinin **Storage** sekmesinden bir **Postgres** (Neon)
   entegrasyonu ekle → `POSTGRES_URL` otomatik ayarlanır.
2. Aynı sekmeden bir **Blob** store ekle → `BLOB_READ_WRITE_TOKEN` otomatik
   ayarlanır.
3. Environment Variables'a elle ekle: `ADMIN_SECRET_PATH` (`openssl rand
   -hex 24`), `COOKIE_SECRET` (`openssl rand -hex 32`) — bunlar `.env`
   üzerinden hiç commit edilmedi, Vercel'de manuel girilmesi gerekir.
4. Yeniden deploy et; admin panelini `https://<domain>/<ADMIN_SECRET_PATH>/`
   üzerinden aç, bir etkinlik oluştur, gerçek bir Excel + PDF yükleyerek
   Blob entegrasyonunu bu ortamda test edilemeyen tek adım olarak doğrula.
