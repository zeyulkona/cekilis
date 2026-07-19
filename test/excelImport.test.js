process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const db = require('../src/db');
const { importExcelForEvent } = require('../src/services/excelImport');

function bufferFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('imports valid rows and skips in-file duplicates with reasons', () => {
  const eventId = db.prepare('INSERT INTO events (name) VALUES (?)').run('E').lastInsertRowid;
  const buffer = bufferFromRows([
    ['Ad Soyad', 'Giriş Numarası'],
    ['Ayşe Kaya', '1'],
    ['Mehmet Demir', '2'],
    ['Ayşe Kaya', '3'], // duplicate name in this event
    ['Ali Veli', '2'], // duplicate number in this file
  ]);

  const summary = importExcelForEvent(eventId, buffer);
  assert.equal(summary.total, 4);
  assert.equal(summary.inserted, 2);
  assert.equal(summary.skipped.length, 2);
});

test('re-uploading appends only new rows and skips everything already on file', () => {
  const eventId = db.prepare('INSERT INTO events (name) VALUES (?)').run('E2').lastInsertRowid;
  const buffer = bufferFromRows([
    ['Ad Soyad', 'Giriş Numarası'],
    ['Kişi Bir', '10'],
    ['Kişi Iki', '11'],
  ]);

  importExcelForEvent(eventId, buffer);
  const second = importExcelForEvent(eventId, buffer);

  assert.equal(second.inserted, 0);
  assert.equal(second.skipped.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM winners WHERE event_id = ?').get(eventId).c, 2);
});

test('an entry number already used by a different event is skipped, not reused', () => {
  const eventA = db.prepare('INSERT INTO events (name) VALUES (?)').run('A').lastInsertRowid;
  const eventB = db.prepare('INSERT INTO events (name) VALUES (?)').run('B').lastInsertRowid;

  importExcelForEvent(eventA, bufferFromRows([['Ad Soyad', 'Giriş Numarası'], ['Kişi A', '500']]));
  const summary = importExcelForEvent(
    eventB,
    bufferFromRows([['Ad Soyad', 'Giriş Numarası'], ['Kişi B', '500']])
  );

  assert.equal(summary.inserted, 0);
  assert.match(summary.skipped[0].reason, /Numara zaten kayıtlı/);
});

test('rejects a file with unrecognized headers without touching existing data', () => {
  const eventId = db.prepare('INSERT INTO events (name) VALUES (?)').run('E3').lastInsertRowid;
  const buffer = bufferFromRows([
    ['Name', 'Number'],
    ['Someone', '1'],
  ]);

  assert.throws(() => importExcelForEvent(eventId, buffer));
  assert.equal(db.prepare('SELECT COUNT(*) c FROM winners WHERE event_id = ?').get(eventId).c, 0);
});
