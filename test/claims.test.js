process.env.POSTGRES_URL =
  process.env.TEST_POSTGRES_URL || 'postgres://cekilis:cekilis_dev_pw@localhost:5432/cekilis_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const claims = require('../src/services/claims');

test.beforeEach(async () => {
  await db.query('TRUNCATE events, slots, winners, claims RESTART IDENTITY CASCADE');
});

test.after(async () => {
  await db.pool.end();
});

async function makeEventWithSlot(quota) {
  const { rows: eventRows } = await db.query('INSERT INTO events (name) VALUES ($1) RETURNING id', ['Test']);
  const eventId = eventRows[0].id;
  const { rows: slotRows } = await db.query(
    'INSERT INTO slots (event_id, day_label, time_label, quota) VALUES ($1,$2,$3,$4) RETURNING id',
    [eventId, '2026-01-01', '20:00', quota]
  );
  return { eventId, slotId: slotRows[0].id };
}

async function makeWinner(eventId, entryNumber) {
  const { rows } = await db.query(
    'INSERT INTO winners (event_id, full_name, entry_number) VALUES ($1,$2,$3) RETURNING id',
    [eventId, 'Test Kisi', entryNumber]
  );
  return rows[0].id;
}

test('lockSlot rejects once quota is reached', async () => {
  const { eventId, slotId } = await makeEventWithSlot(1);
  const w1 = await makeWinner(eventId, 'A1');
  const w2 = await makeWinner(eventId, 'A2');

  await claims.lockSlot(w1, slotId);
  await assert.rejects(() => claims.lockSlot(w2, slotId), claims.SlotFullError);

  const { rows } = await db.query('SELECT * FROM claims WHERE slot_id = $1', [slotId]);
  assert.equal(rows.length, 1);
});

test('a winner cannot hold two active locks at once (different slots)', async () => {
  const { eventId, slotId } = await makeEventWithSlot(5);
  const { slotId: otherSlotId } = await makeEventWithSlot(5);
  const w1 = await makeWinner(eventId, 'B1');

  await claims.lockSlot(w1, slotId);
  await assert.rejects(() => claims.lockSlot(w1, otherSlotId), claims.AlreadyLockedError);
});

test('entry number is single-use: cannot lock again after claiming', async () => {
  const { eventId, slotId } = await makeEventWithSlot(5);
  const { slotId: otherSlotId } = await makeEventWithSlot(5);
  const w1 = await makeWinner(eventId, 'C1');

  await claims.lockSlot(w1, slotId);
  const confirmed = await claims.confirmClaim(w1, slotId);
  assert.equal(confirmed, true);

  await assert.rejects(() => claims.lockSlot(w1, otherSlotId), claims.AlreadyUsedError);
});

test('confirmClaim fails once the 5-minute lock has expired', async () => {
  const { eventId, slotId } = await makeEventWithSlot(5);
  const w1 = await makeWinner(eventId, 'D1');

  const claim = await claims.lockSlot(w1, slotId);
  await db.query("UPDATE claims SET expires_at = now() - interval '1 second' WHERE id = $1", [claim.id]);

  const confirmed = await claims.confirmClaim(w1, slotId);
  assert.equal(confirmed, false);
});

test('an expired lock releases the slot for someone else without waiting for a sweep', async () => {
  const { eventId, slotId } = await makeEventWithSlot(1);
  const w1 = await makeWinner(eventId, 'E1');
  const w2 = await makeWinner(eventId, 'E2');

  const claim = await claims.lockSlot(w1, slotId);
  await db.query("UPDATE claims SET expires_at = now() - interval '1 second' WHERE id = $1", [claim.id]);

  // No sweep has run; this must succeed purely via the lazy time-aware check.
  await assert.doesNotReject(() => claims.lockSlot(w2, slotId));
});

test('20 truly concurrent lock attempts (real overlapping transactions) on a quota=1 slot: exactly one succeeds', async () => {
  const { eventId, slotId } = await makeEventWithSlot(1);
  const winnerIds = [];
  for (let i = 0; i < 20; i += 1) {
    winnerIds.push(await makeWinner(eventId, `F${i}`));
  }

  const results = await Promise.all(
    winnerIds.map((id) =>
      claims
        .lockSlot(id, slotId)
        .then(() => true)
        .catch(() => false)
    )
  );

  assert.equal(results.filter(Boolean).length, 1);
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM claims WHERE slot_id = $1', [slotId]);
  assert.equal(rows[0].c, 1);
});
