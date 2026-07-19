process.env.POSTGRES_URL =
  process.env.TEST_POSTGRES_URL || 'postgres://cekilis:cekilis_dev_pw@localhost:5432/cekilis_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const db = require('../src/db');
const { importExcelForEvent } = require('../src/services/excelImport');

test.beforeEach(async () => {
  await db.query('TRUNCATE events, slots, winners, claims RESTART IDENTITY CASCADE');
});

test.after(async () => {
  await db.pool.end();
});

function bufferFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function makeEvent(name) {
  const { rows } = await db.query('INSERT INTO events (name) VALUES ($1) RETURNING id', [name]);
  return rows[0].id;
}

test('imports valid rows and skips in-file duplicates with reasons', async () => {
  const eventId = await makeEvent('E');
  const buffer = bufferFromRows([
    ['Ad Soyad', 'Giriş Numarası'],
    ['Ayşe Kaya', '1'],
    ['Mehmet Demir', '2'],
    ['Ayşe Kaya', '3'], // duplicate name in this event
    ['Ali Veli', '2'], // duplicate number in this file
  ]);

  const summary = await importExcelForEvent(eventId, buffer);
  assert.equal(summary.total, 4);
  assert.equal(summary.inserted, 2);
  assert.equal(summary.skipped.length, 2);
});

test('re-uploading appends only new rows and skips everything already on file', async () => {
  const eventId = await makeEvent('E2');
  const buffer = bufferFromRows([
    ['Ad Soyad', 'Giriş Numarası'],
    ['Kişi Bir', '10'],
    ['Kişi Iki', '11'],
  ]);

  await importExcelForEvent(eventId, buffer);
  const second = await importExcelForEvent(eventId, buffer);

  assert.equal(second.inserted, 0);
  assert.equal(second.skipped.length, 2);
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM winners WHERE event_id = $1', [eventId]);
  assert.equal(rows[0].c, 2);
});

test('an entry number already used by a different event is skipped, not reused', async () => {
  const eventA = await makeEvent('A');
  const eventB = await makeEvent('B');

  await importExcelForEvent(eventA, bufferFromRows([['Ad Soyad', 'Giriş Numarası'], ['Kişi A', '500']]));
  const summary = await importExcelForEvent(
    eventB,
    bufferFromRows([['Ad Soyad', 'Giriş Numarası'], ['Kişi B', '500']])
  );

  assert.equal(summary.inserted, 0);
  assert.match(summary.skipped[0].reason, /Numara zaten kayıtlı/);
});

test('rejects a file with unrecognized headers without touching existing data', async () => {
  const eventId = await makeEvent('E3');
  const buffer = bufferFromRows([
    ['Name', 'Number'],
    ['Someone', '1'],
  ]);

  await assert.rejects(() => importExcelForEvent(eventId, buffer));
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM winners WHERE event_id = $1', [eventId]);
  assert.equal(rows[0].c, 0);
});
