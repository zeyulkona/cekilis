const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { maskName, findByEntryNumber } = require('../services/winners');
const claims = require('../services/claims');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads');
const PDF_DIR = path.join(UPLOAD_DIR, 'pdfs');

const COOKIE_NAME = 'wid';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', signed: true, maxAge: 60 * 60 * 1000 };

// Anti-enumeration guardrail (INTENT.md Bölüm 5): the entry-number lookup
// is the system's whole attack surface now that there's no public list, so
// it's rate-limited per IP rather than relying solely on generic messages.
const entryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
});

function requireWinner(req, res, next) {
  const winnerId = req.signedCookies[COOKIE_NAME];
  if (!winnerId) return res.redirect('/');
  const winner = db.prepare('SELECT * FROM winners WHERE id = ?').get(winnerId);
  if (!winner) return res.redirect('/');
  req.winner = winner;
  next();
}

router.get('/', (req, res) => {
  res.render('user/entry', { error: null });
});

router.post('/giris', entryLimiter, (req, res) => {
  const entryNumber = String(req.body.entry_number || '').trim();
  if (!entryNumber) {
    return res.render('user/entry', { error: 'Lütfen giriş numaranızı yazın.' });
  }

  const winner = findByEntryNumber(entryNumber);
  if (!winner) {
    return res.render('user/entry', { error: 'Numara geçersiz. Lütfen tekrar deneyin.' });
  }

  res.cookie(COOKIE_NAME, String(winner.id), COOKIE_OPTS);
  res.redirect('/etkinlik');
});

router.get('/etkinlik', requireWinner, (req, res) => {
  const { winner } = req;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(winner.event_id);
  const maskedName = maskName(winner.full_name);
  const active = claims.activeClaimForWinner(winner.id);

  if (active && active.status === 'claimed') {
    return res.render('user/success', { event, maskedName });
  }
  if (active && active.status === 'locked') {
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(active.slot_id);
    return res.render('user/lock', { event, slot, claim: active, maskedName, lockMinutes: claims.LOCK_MINUTES });
  }

  const slots = claims.slotsForEvent(winner.event_id);
  res.render('user/slots', { event, slots, maskedName, message: req.query.msg || null });
});

router.post('/slot/:id/kilitle', requireWinner, (req, res) => {
  const slotId = Number(req.params.id);
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
  if (!slot || slot.event_id !== req.winner.event_id) {
    return res.status(404).render('user/error', { message: 'Slot bulunamadı.' });
  }

  try {
    claims.lockSlot(req.winner.id, slotId);
    return res.redirect('/etkinlik');
  } catch (err) {
    if (err instanceof claims.SlotFullError) {
      return res.redirect('/etkinlik?msg=dolu');
    }
    if (err instanceof claims.AlreadyLockedError || err instanceof claims.AlreadyUsedError) {
      return res.redirect('/etkinlik');
    }
    throw err;
  }
});

router.post('/slot/:id/onayla', requireWinner, (req, res) => {
  const slotId = Number(req.params.id);
  const ok = claims.confirmClaim(req.winner.id, slotId);
  if (!ok) {
    return res.redirect('/etkinlik?msg=suresi_doldu');
  }
  res.redirect('/etkinlik');
});

router.post('/slot/:id/vazgec', requireWinner, (req, res) => {
  claims.cancelClaim(req.winner.id, Number(req.params.id));
  res.redirect('/etkinlik');
});

router.get('/etkinlik/:id/bilet.pdf', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event || !event.pdf_uploaded_at) {
    return res.status(404).render('user/error', { message: 'Bilet bulunamadı.' });
  }
  res.download(path.join(PDF_DIR, `event-${event.id}.pdf`), `${event.name}-bilet.pdf`);
});

router.post('/cikis', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/');
});

module.exports = router;
