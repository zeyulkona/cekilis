# cekilis

Etkinlik bilet dağıtım sistemi. Ürün kuralları için `INTENT.md`, geliştirme
rehberi için `CLAUDE.md`, tasarım için `Design.md`, teknik mimari için
`plan.md` dosyalarına bakın.

## Kurulum

```bash
npm install
cp .env.example .env
```

`.env` içinde `ADMIN_SECRET_PATH` ve `COOKIE_SECRET` değerlerini rastgele
üretilmiş uzun dizgilerle doldurun:

```bash
openssl rand -hex 24   # ADMIN_SECRET_PATH için
openssl rand -hex 32   # COOKIE_SECRET için
```

## Çalıştırma

```bash
npm start
```

Kullanıcı paneli: `http://localhost:PORT/`
Admin paneli: `http://localhost:PORT/<ADMIN_SECRET_PATH>/` — bu path'i
kimseyle paylaşmayın, kaynak kontrolüne asla eklemeyin.

## Test

```bash
npm test
```

Kilit/tekillik/kontenjan mantığı (`src/services/claims.js`) ve Excel
import/append/duplicate-atlama mantığı (`src/services/excelImport.js`)
için `test/` altında otomatik testler var.

## Veri ve dosyalar

`data/` klasörü (SQLite veritabanı + yüklenen PDF/Excel dosyaları) git'e
dahil değildir; VPS'te bu klasörü düzenli yedekleyin (`.backup` veya düz
dosya kopyası yeterlidir, bkz. `plan.md` Faz 6).

## Admin URL rotasyonu

`.env` içindeki `ADMIN_SECRET_PATH` değerini değiştirip süreci yeniden
başlatmanız yeterlidir (`systemctl restart cekilis` veya `npm start`).
