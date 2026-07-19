require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const claims = require('./src/services/claims');
const userRoutes = require('./src/routes/user');
const adminRoutes = require('./src/routes/admin');

const ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH;
const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET) {
  throw new Error('COOKIE_SECRET env değişkeni tanımlı olmalı (.env dosyasına bakın).');
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// Admin URL secrecy (INTENT.md Bölüm 5): never let the secret path reach
// the log output in cleartext, even though admin activity is still logged.
app.use((req, res, next) => {
  const isAdminPath = ADMIN_SECRET_PATH && req.path.startsWith(`/${ADMIN_SECRET_PATH}`);
  const logPath = isAdminPath ? req.path.replace(ADMIN_SECRET_PATH, '[admin]') : req.path;
  console.log(`${req.method} ${logPath}`);
  next();
});

if (ADMIN_SECRET_PATH) {
  app.use(`/${ADMIN_SECRET_PATH}`, adminRoutes);
} else {
  console.error('ADMIN_SECRET_PATH env değişkeni tanımlı değil — admin paneli devre dışı.');
}

app.use('/', userRoutes);

app.use((req, res) => {
  res.status(404).render('user/error', { message: 'Sayfa bulunamadı.' });
});

// Generic error page only — never echo req.originalUrl or a stack trace
// into the response (that would leak the admin secret path on admin routes).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('user/error', { message: 'Sunucu hatası oluştu.' });
});

claims.startSweeper();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`cekilis dinleniyor: http://localhost:${PORT}`);
});
