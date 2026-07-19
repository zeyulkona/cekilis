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
// elapse before any sweep gets around to flagging it `expired`.
const OCCUPIED_COUNT_SQL = `
  SELECT COUNT(*) AS c FROM claims
  WHERE slot_id = ?
    AND (status = 'claimed' OR (status = 'locked' AND expires_at > datetime('now')))
`;

function occupiedCount(slotId) {
  return db.prepare(OCCUPIED_COUNT_SQL).get(slotId).c;
}

function slotsForEvent(eventId) {
  const slots = db
    .prepare('SELECT * FROM slots WHERE event_id = ? ORDER BY day_label, time_label')
    .all(eventId);
  return slots.map((slot) => {
    const occupied = occupiedCount(slot.id);
    return { ...slot, occupied, full: occupied >= slot.quota };
  });
}

// Expire this winner's own stale lock, if any. Needed because the partial
// unique index on claims(winner_id) can't evaluate wall-clock time, so a
// row can sit at status='locked' after expires_at has passed.
function reconcileWinnerLocks(winnerId) {
  db.prepare(
    `UPDATE claims SET status = 'expired'
     WHERE winner_id = ? AND status = 'locked' AND expires_at <= datetime('now')`
  ).run(winnerId);
}

function activeClaimForWinner(winnerId) {
  reconcileWinnerLocks(winnerId);
  return db
    .prepare(
      `SELECT * FROM claims WHERE winner_id = ? AND status IN ('locked', 'claimed')
       ORDER BY id DESC LIMIT 1`
    )
    .get(winnerId);
}

const lockSlotTxn = db.transaction((winnerId, slotId) => {
  reconcileWinnerLocks(winnerId);

  const active = db
    .prepare(`SELECT * FROM claims WHERE winner_id = ? AND status IN ('locked', 'claimed')`)
    .get(winnerId);
  if (active) {
    if (active.status === 'claimed') throw new AlreadyUsedError();
    throw new AlreadyLockedError(active);
  }

  // Capacity check + insert as one indivisible statement: the read (count)
  // and the write (insert) cannot be interleaved by another request, so
  // two racing requests can never both see room for the same last seat.
  const result = db
    .prepare(
      `INSERT INTO claims (winner_id, slot_id, status, locked_at, expires_at)
       SELECT ?, ?, 'locked', datetime('now'), datetime('now', '+${LOCK_MINUTES} minutes')
       WHERE (
         SELECT COUNT(*) FROM claims
         WHERE slot_id = ?
           AND (status = 'claimed' OR (status = 'locked' AND expires_at > datetime('now')))
       ) < (SELECT quota FROM slots WHERE id = ?)`
    )
    .run(winnerId, slotId, slotId, slotId);

  if (result.changes === 0) throw new SlotFullError();
  return db.prepare('SELECT * FROM claims WHERE id = ?').get(result.lastInsertRowid);
});

function lockSlot(winnerId, slotId) {
  return lockSlotTxn(winnerId, slotId);
}

const confirmClaimTxn = db.transaction((winnerId, slotId) => {
  const result = db
    .prepare(
      `UPDATE claims SET status = 'claimed', claimed_at = datetime('now')
       WHERE winner_id = ? AND slot_id = ? AND status = 'locked' AND expires_at > datetime('now')`
    )
    .run(winnerId, slotId);
  return result.changes === 1;
});

function confirmClaim(winnerId, slotId) {
  return confirmClaimTxn(winnerId, slotId);
}

const cancelClaimTxn = db.transaction((winnerId, slotId) => {
  db.prepare(
    `UPDATE claims SET status = 'expired'
     WHERE winner_id = ? AND slot_id = ? AND status = 'locked'`
  ).run(winnerId, slotId);
});

function cancelClaim(winnerId, slotId) {
  return cancelClaimTxn(winnerId, slotId);
}

// Cosmetic-only cleanup: correctness never depends on this having run,
// since every read above applies the time-aware predicate directly.
function sweepExpiredLocks() {
  db.prepare(
    `UPDATE claims SET status = 'expired' WHERE status = 'locked' AND expires_at <= datetime('now')`
  ).run();
}

let sweeperHandle = null;
function startSweeper() {
  if (sweeperHandle) return;
  sweeperHandle = setInterval(sweepExpiredLocks, 60_000);
  sweeperHandle.unref();
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
  startSweeper,
};
