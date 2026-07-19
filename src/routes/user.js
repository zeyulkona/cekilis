const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { maskName, findByEntryNumber } = require('../services/winners');
const claims = require('../services/claims');

const router = express.Router();

const COOKIE_NAME = 'wid';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', signed: true, maxAge: 60 * 60 * 1000 };

// Anti-enumeration guardrail (INTENT.md Bölüm 5): the entry-number lookup
// is the system's whole attack surface now that there's no public list, so
// it's rate-limited per IP rather than relying solely on generic messages.
// Note: on Vercel each serverless instance keeps its own in-memory counter,
// so this is a best-effort control under that deployment, not a hard cap
// across every instance — flagged here rather than silently assumed solid.
const entryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
});

async function requireWinner(req, res, next) {
  const winnerId = req.signedCookies[COOKIE_NAME];
  if (!winnerId) return res.redirect('/');
  const { rows } = await db.query('SELECT * FROM winners WHERE id = $1', [winnerId]);
  if (!rows[0]) return res.redirect('/');
  req.winner = rows[0];
  next();
}

router.get('/', (req, res) => {
  res.render('user/entry', { error: null });
});

router.post('/giris', entryLimiter, async (req, res) => {
  const entryNumber = String(req.body.entry_number || '').trim();
  if (!entryNumber) {
    return res.render('user/entry', { error: 'Lütfen giriş numaranızı yazın.' });
  }

  const winner = await findByEntryNumber(entryNumber);
  if (!winner) {
    return res.render('user/entry', { error: 'Numara geçersiz. Lütfen tekrar deneyin.' });
  }

  res.cookie(COOKIE_NAME, String(winner.id), COOKIE_OPTS);
  res.redirect('/etkinlik');
});

router.get('/etkinlik', requireWinner, async (req, res) => {
  const { winner } = req;
  const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [winner.event_id]);
  const event = eventRows[0];
  const maskedName = maskName(winner.full_name);
  const active = await claims.activeClaimForWinner(winner.id);

  if (active && active.status === 'claimed') {
    return res.render('user/success', { event, maskedName });
  }
  if (active && active.status === 'locked') {
    const { rows: slotRows } = await db.query('SELECT * FROM slots WHERE id = $1', [active.slot_id]);
    return res.render('user/lock', {
      event,
      slot: slotRows[0],
      claim: active,
      maskedName,
      lockMinutes: claims.LOCK_MINUTES,
    });
  }

  const slots = await claims.slotsForEvent(winner.event_id);
  res.render('user/slots', { event, slots, maskedName, message: req.query.msg || null });
});

router.post('/slot/:id/kilitle', requireWinner, async (req, res) => {
  const slotId = Number(req.params.id);
  const { rows: slotRows } = await db.query('SELECT * FROM slots WHERE id = $1', [slotId]);
  const slot = slotRows[0];
  if (!slot || slot.event_id !== req.winner.event_id) {
    return res.status(404).render('user/error', { message: 'Slot bulunamadı.' });
  }

  try {
    await claims.lockSlot(req.winner.id, slotId);
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

router.post('/slot/:id/onayla', requireWinner, async (req, res) => {
  const slotId = Number(req.params.id);
  const ok = await claims.confirmClaim(req.winner.id, slotId);
  if (!ok) {
    return res.redirect('/etkinlik?msg=suresi_doldu');
  }
  res.redirect('/etkinlik');
});

router.post('/slot/:id/vazgec', requireWinner, async (req, res) => {
  await claims.cancelClaim(req.winner.id, Number(req.params.id));
  res.redirect('/etkinlik');
});

router.get('/etkinlik/:id/bilet.pdf', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  const event = rows[0];
  if (!event || !event.pdf_url) {
    return res.status(404).render('user/error', { message: 'Bilet bulunamadı.' });
  }
  res.redirect(event.pdf_url);
});

router.post('/cikis', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/');
});

module.exports = router;
