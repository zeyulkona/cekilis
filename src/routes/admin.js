const express = require('express');
const multer = require('multer');
const db = require('../db');
const { importExcelForEvent } = require('../services/excelImport');
const { slotsForEvent } = require('../services/claims');
const { uploadEventPdf } = require('../services/blobStorage');

const router = express.Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Admin pages must never be indexed — the secret URL is the only access
// control (see INTENT.md Bölüm 1 ve 5).
router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

async function loadEventDetail(eventId) {
  const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
  const event = eventRows[0];
  if (!event) return null;
  const slots = await slotsForEvent(eventId);
  const { rows: countRows } = await db.query(
    'SELECT COUNT(*)::int AS c FROM winners WHERE event_id = $1',
    [eventId]
  );
  return { event, slots, winnerCount: countRows[0].c };
}

router.get('/', async (req, res) => {
  const { rows: events } = await db.query('SELECT * FROM events ORDER BY created_at DESC');
  res.render('admin/dashboard', { events, basePath: req.baseUrl });
});

router.get('/etkinlikler/yeni', (req, res) => {
  res.render('admin/event-new', { error: null, basePath: req.baseUrl });
});

router.post('/etkinlikler', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.render('admin/event-new', { error: 'Etkinlik adı zorunlu.', basePath: req.baseUrl });
  }
  const { rows } = await db.query(
    'INSERT INTO events (name, description) VALUES ($1, $2) RETURNING id',
    [name, req.body.description ? String(req.body.description).trim() : null]
  );
  res.redirect(`${req.baseUrl}/etkinlikler/${rows[0].id}`);
});

router.get('/etkinlikler/:id', async (req, res) => {
  const detail = await loadEventDetail(req.params.id);
  if (!detail) return res.status(404).render('user/error', { message: 'Etkinlik bulunamadı.' });
  res.render('admin/event-detail', { ...detail, importSummary: null, pdfError: null, basePath: req.baseUrl });
});

router.post('/etkinlikler/:id/slotlar', async (req, res) => {
  const { day_label, time_label, quota } = req.body;
  const q = Number(quota);
  if (day_label && time_label && q > 0) {
    await db.query(
      'INSERT INTO slots (event_id, day_label, time_label, quota) VALUES ($1, $2, $3, $4)',
      [req.params.id, String(day_label).trim(), String(time_label).trim(), q]
    );
  }
  res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
});

router.post('/etkinlikler/:id/slotlar/:slotId/kontenjan', async (req, res) => {
  const q = Number(req.body.quota);
  if (q > 0) {
    await db.query('UPDATE slots SET quota = $1 WHERE id = $2 AND event_id = $3', [
      q,
      req.params.slotId,
      req.params.id,
    ]);
  }
  res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
});

router.post('/etkinlikler/:id/excel', excelUpload.single('excel'), async (req, res) => {
  const detail = await loadEventDetail(req.params.id);
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
    const summary = await importExcelForEvent(detail.event.id, req.file.buffer);
    const refreshed = await loadEventDetail(req.params.id);
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
  pdfUpload.single('pdf')(req, res, async (err) => {
    const detail = await loadEventDetail(req.params.id);
    if (!detail) return res.status(404).render('user/error', { message: 'Etkinlik bulunamadı.' });

    if (err || !req.file) {
      return res.render('admin/event-detail', {
        ...detail,
        importSummary: null,
        pdfError: 'PDF yüklenemedi. Yalnızca PDF dosyaları kabul edilir.',
        basePath: req.baseUrl,
      });
    }

    try {
      const pdfUrl = await uploadEventPdf(detail.event.id, req.file.buffer);
      await db.query(
        "UPDATE events SET pdf_url = $1, pdf_uploaded_at = now() WHERE id = $2",
        [pdfUrl, req.params.id]
      );
      res.redirect(`${req.baseUrl}/etkinlikler/${req.params.id}`);
    } catch (uploadErr) {
      res.render('admin/event-detail', {
        ...detail,
        importSummary: null,
        pdfError: uploadErr.message,
        basePath: req.baseUrl,
      });
    }
  });
});

module.exports = router;
