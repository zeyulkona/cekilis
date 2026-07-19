const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { importExcelForEvent } = require('../services/excelImport');
const { slotsForEvent } = require('../services/claims');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads');
const PDF_DIR = path.join(UPLOAD_DIR, 'pdfs');
fs.mkdirSync(PDF_DIR, { recursive: true });

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: PDF_DIR,
    filename: (req, file, cb) => cb(null, `event-${req.params.id}.pdf`),
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Admin pages must never be indexed — the secret URL is the only access
// control (see INTENT.md Bölüm 1 ve 5).
router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

function loadEventDetail(eventId) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return null;
  const slots = slotsForEvent(eventId);
  const winnerCount = db.prepare('SELECT COUNT(*) c FROM winners WHERE event_id = ?').get(eventId).c;
  return { event, slots, winnerCount };
}

router.get('/', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
  res.render('admin/dashboard', { events, basePath: req.baseUrl });
});

router.get('/etkinlikler/yeni', (req, res) => {
  res.render('admin/event-new', { error: null, basePath: req.baseUrl });
});

router.post('/etkinlikler', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.render('admin/event-new', { error: 'Etkinlik adı zorunlu.', basePath: req.baseUrl });
  }
  const info = db
    .prepare('INSERT INTO events (name, description) VALUES (?, ?)')
    .run(name, req.body.description ? String(req.body.description).trim() : null);
  res.redirect(`${req.baseUrl}/etkinlikler/${info.lastInsertRowid}`);
});

router.get('/etkinlikler/:id', (req, res) => {
  const detail = loadEventDetail(req.params.id);
  if (!detail) return res.status(404).render('user/error', { message: 'Etkinlik bulunamadı.' });
  res.render('admin/event-detail', { ...detail, importSummary: null, pdfError: null, basePath: req.baseUrl });
});

router.post('/etkinlikler/:id/slotlar', (req, res) => {
  const { day_label, time_label, quota } = req.body;
  const q = Number(quota);
  if (day_label && time_label && q > 0) {
    db.prepare('INSERT INTO slots (event_id, day_label, time_label, quota) VALUES (?, ?, ?, ?)').run(
      req.params.id,
      String(day_label).trim(),
      String(time_label).trim(),
      q
    );
  }
  res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
});

router.post('/etkinlikler/:id/slotlar/:slotId/kontenjan', (req, res) => {
  const q = Number(req.body.quota);
  if (q > 0) {
    db.prepare('UPDATE slots SET quota = ? WHERE id = ? AND event_id = ?').run(
      q,
      req.params.slotId,
      req.params.id
    );
  }
  res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
});

router.post('/etkinlikler/:id/excel', excelUpload.single('excel'), (req, res) => {
  const detail = loadEventDetail(req.params.id);
  if (!detail) return res.status(404).render('user/error', { message: 'Etkinlik bulunamadı.' });

  if (!req.file) {
    return res.render('admin/event-detail', {
      ...detail,
      importSummary: { error: 'Bir dosya seçmediniz.' },
      pdfError: null,
      basePath: req.baseUrl,
    });
  }

  try {
    const summary = importExcelForEvent(detail.event.id, req.file.buffer);
    const refreshed = loadEventDetail(req.params.id);
    res.render('admin/event-detail', {
      ...refreshed,
      importSummary: summary,
      pdfError: null,
      basePath: req.baseUrl,
    });
  } catch (err) {
    res.render('admin/event-detail', {
      ...detail,
      importSummary: { error: err.message },
      pdfError: null,
      basePath: req.baseUrl,
    });
  }
});

router.post('/etkinlikler/:id/pdf', (req, res, next) => {
  pdfUpload.single('pdf')(req, res, (err) => {
    const detail = loadEventDetail(req.params.id);
    if (!detail) return res.status(404).render('user/error', { message: 'Etkinlik bulunamadı.' });

    if (err || !req.file) {
      return res.render('admin/event-detail', {
        ...detail,
        importSummary: null,
        pdfError: 'PDF yüklenemedi. Yalnızca PDF dosyaları kabul edilir.',
        basePath: req.baseUrl,
      });
    }

    db.prepare("UPDATE events SET pdf_uploaded_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
  });
});

module.exports = router;
