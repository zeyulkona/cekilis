process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const claims = require('../src/services/claims');

function makeEventWithSlot(quota) {
  const eventId = db.prepare('INSERT INTO events (name) VALUES (?)').run('Test').lastInsertRowid;
  const slotId = db
    .prepare('INSERT INTO slots (event_id, day_label, time_label, quota) VALUES (?,?,?,?)')
    .run(eventId, '2026-01-01', '20:00', quota).lastInsertRowid;
  return { eventId, slotId };
}

function makeWinner(eventId, entryNumber) {
  return db
    .prepare('INSERT INTO winners (event_id, full_name, entry_number) VALUES (?,?,?)')
    .run(eventId, 'Test Kisi', entryNumber).lastInsertRowid;
}

test('lockSlot rejects once quota is reached', () => {
  const { eventId, slotId } = makeEventWithSlot(1);
  const w1 = makeWinner(eventId, 'A1');
  const w2 = makeWinner(eventId, 'A2');

  claims.lockSlot(w1, slotId);
  assert.throws(() => claims.lockSlot(w2, slotId), claims.SlotFullError);

  const rows = db.prepare('SELECT * FROM claims WHERE slot_id = ?').all(slotId);
  assert.equal(rows.length, 1);
});

test('a winner cannot hold two active locks at once', () => {
  const { eventId, slotId } = makeEventWithSlot(5);
  const { slotId: otherSlotId } = makeEventWithSlot(5);
  const w1 = makeWinner(eventId, 'B1');

  claims.lockSlot(w1, slotId);
  assert.throws(() => claims.lockSlot(w1, otherSlotId), claims.AlreadyLockedError);
});

test('entry number is single-use: cannot lock again after claiming', () => {
  const { eventId, slotId } = makeEventWithSlot(5);
  const { slotId: otherSlotId } = makeEventWithSlot(5);
  const w1 = makeWinner(eventId, 'C1');

  claims.lockSlot(w1, slotId);
  const confirmed = claims.confirmClaim(w1, slotId);
  assert.equal(confirmed, true);

  assert.throws(() => claims.lockSlot(w1, otherSlotId), claims.AlreadyUsedError);
});

test('confirmClaim fails once the 5-minute lock has expired', () => {
  const { eventId, slotId } = makeEventWithSlot(5);
  const w1 = makeWinner(eventId, 'D1');

  const claim = claims.lockSlot(w1, slotId);
  db.prepare("UPDATE claims SET expires_at = datetime('now', '-1 second') WHERE id = ?").run(claim.id);

  const confirmed = claims.confirmClaim(w1, slotId);
  assert.equal(confirmed, false);
});

test('an expired lock releases the slot for someone else without waiting for the sweep', () => {
  const { eventId, slotId } = makeEventWithSlot(1);
  const w1 = makeWinner(eventId, 'E1');
  const w2 = makeWinner(eventId, 'E2');

  const claim = claims.lockSlot(w1, slotId);
  db.prepare("UPDATE claims SET expires_at = datetime('now', '-1 second') WHERE id = ?").run(claim.id);

  // No sweep has run; this must succeed purely via the lazy time-aware check.
  assert.doesNotThrow(() => claims.lockSlot(w2, slotId));
});

test('20 concurrent lock attempts on a quota=1 slot: exactly one succeeds', async () => {
  const { eventId, slotId } = makeEventWithSlot(1);
  const winnerIds = Array.from({ length: 20 }, (_, i) => makeWinner(eventId, `F${i}`));

  const results = await Promise.all(
    winnerIds.map((id) =>
      Promise.resolve().then(() => {
        try {
          claims.lockSlot(id, slotId);
          return true;
        } catch {
          return false;
        }
      })
    )
  );

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM claims WHERE slot_id = ?').get(slotId).c, 1);
});
