const db = require('../db');

const LOCK_MINUTES = 5;

class AlreadyUsedError extends Error {}
class AlreadyLockedError extends Error {
  constructor(claim) {
    super('winner already has an active lock');
    this.claim = claim;
  }
}
class SlotFullError extends Error {}

// Single source of truth for "is this slot occupying a seat right now" —
// never trust the `status` column alone, since a lock's 5 minutes can
// elapse before anything gets around to flagging it `expired`.
async function occupiedCount(executor, slotId) {
  const { rows } = await executor.query(
    `SELECT COUNT(*)::int AS c FROM claims
     WHERE slot_id = $1
       AND (status = 'claimed' OR (status = 'locked' AND expires_at > now()))`,
    [slotId]
  );
  return rows[0].c;
}

async function slotsForEvent(eventId) {
  const { rows: slots } = await db.query(
    'SELECT * FROM slots WHERE event_id = $1 ORDER BY day_label, time_label',
    [eventId]
  );
  const result = [];
  for (const slot of slots) {
    const occupied = await occupiedCount(db, slot.id);
    result.push({ ...slot, occupied, full: occupied >= slot.quota });
  }
  return result;
}

// Expire this winner's own stale lock, if any. Needed because the partial
// unique index on claims(winner_id) can't evaluate wall-clock time, so a
// row can sit at status='locked' after expires_at has passed.
async function reconcileWinnerLocks(executor, winnerId) {
  await executor.query(
    `UPDATE claims SET status = 'expired'
     WHERE winner_id = $1 AND status = 'locked' AND expires_at <= now()`,
    [winnerId]
  );
}

async function activeClaimForWinner(winnerId) {
  await reconcileWinnerLocks(db, winnerId);
  const { rows } = await db.query(
    `SELECT * FROM claims WHERE winner_id = $1 AND status IN ('locked', 'claimed')
     ORDER BY id DESC LIMIT 1`,
    [winnerId]
  );
  return rows[0];
}

// Vercel serverless invocations run as genuinely separate, concurrent
// processes — there is no single JS thread to rely on here (unlike a
// single continuous Node process). Correctness instead comes from a real
// Postgres row lock: `SELECT ... FOR UPDATE` on the slot row serializes
// any other transaction racing for the *same* slot until this one commits
// or rolls back, so the capacity check + insert below can't be raced.
async function lockSlot(winnerId, slotId) {
  try {
    return await db.withTransaction(async (client) => {
      await client.query('SELECT id FROM slots WHERE id = $1 FOR UPDATE', [slotId]);

      await reconcileWinnerLocks(client, winnerId);

      const { rows: activeRows } = await client.query(
        `SELECT * FROM claims WHERE winner_id = $1 AND status IN ('locked', 'claimed')`,
        [winnerId]
      );
      const active = activeRows[0];
      if (active) {
        if (active.status === 'claimed') throw new AlreadyUsedError();
        throw new AlreadyLockedError(active);
      }

      const occupied = await occupiedCount(client, slotId);
      const { rows: slotRows } = await client.query('SELECT quota FROM slots WHERE id = $1', [slotId]);
      if (!slotRows[0] || occupied >= slotRows[0].quota) {
        throw new SlotFullError();
      }

      const { rows: inserted } = await client.query(
        `INSERT INTO claims (winner_id, slot_id, status, locked_at, expires_at)
         VALUES ($1, $2, 'locked', now(), now() + interval '5 minutes')
         RETURNING *`,
        [winnerId, slotId]
      );
      return inserted[0];
    });
  } catch (err) {
    // Same winner racing two *different* slots at once (e.g. two tabs):
    // the slot-row lock above doesn't cover this, since it's two different
    // rows. The partial unique index on claims(winner_id) is the actual
    // safety net for that case.
    if (err.code === '23505' && err.constraint === 'ux_claims_active_winner') {
      throw new AlreadyLockedError();
    }
    throw err;
  }
}

async function confirmClaim(winnerId, slotId) {
  const { rows } = await db.query(
    `UPDATE claims SET status = 'claimed', claimed_at = now()
     WHERE winner_id = $1 AND slot_id = $2 AND status = 'locked' AND expires_at > now()
     RETURNING id`,
    [winnerId, slotId]
  );
  return rows.length === 1;
}

async function cancelClaim(winnerId, slotId) {
  await db.query(
    `UPDATE claims SET status = 'expired'
     WHERE winner_id = $1 AND slot_id = $2 AND status = 'locked'`,
    [winnerId, slotId]
  );
}

// Cosmetic-only cleanup: correctness never depends on this having run,
// since every read above applies the time-aware predicate directly. There
// is no persistent process to run this on a timer under serverless — wire
// it to a Vercel Cron Job hitting a maintenance route if periodic tidying
// is ever wanted.
async function sweepExpiredLocks() {
  await db.query(
    `UPDATE claims SET status = 'expired' WHERE status = 'locked' AND expires_at <= now()`
  );
}

module.exports = {
  LOCK_MINUTES,
  AlreadyUsedError,
  AlreadyLockedError,
  SlotFullError,
  occupiedCount,
  slotsForEvent,
  activeClaimForWinner,
  lockSlot,
  confirmClaim,
  cancelClaim,
  sweepExpiredLocks,
};
