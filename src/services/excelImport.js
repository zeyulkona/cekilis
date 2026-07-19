const XLSX = require('xlsx');
const db = require('../db');

const NAME_HEADERS = ['ad soyad', 'adsoyad', 'ad-soyad', 'isim', 'ad soyadı'];
const NUMBER_HEADERS = ['giriş numarası', 'giris numarasi', 'giriş no', 'giris no', 'numara', 'entry number'];

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase();
}

function normalizeName(n) {
  return String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (rows.length === 0) {
    throw new Error('Excel dosyası boş.');
  }

  const headerRow = rows[0].map(normalizeHeader);
  const nameIdx = headerRow.findIndex((h) => NAME_HEADERS.includes(h));
  const numberIdx = headerRow.findIndex((h) => NUMBER_HEADERS.includes(h));
  if (nameIdx === -1 || numberIdx === -1) {
    throw new Error('Excel başlıkları tanınamadı. Dosyada "Ad Soyad" ve "Giriş Numarası" kolonları olmalı.');
  }

  return rows
    .slice(1)
    .map((row) => ({
      full_name: String(row[nameIdx] ?? '').trim(),
      entry_number: String(row[numberIdx] ?? '').trim(),
    }))
    .filter((row) => row.full_name || row.entry_number);
}

// Append-only import: existing rows are never touched. Duplicate entry
// numbers (checked system-wide, since entry_number is globally unique —
// see INTENT.md v5) or duplicate names within this event are skipped, not
// silently dropped — every skip is reported back with a reason.
async function importExcelForEvent(eventId, buffer) {
  const rows = parseWorkbook(buffer);
  const skipped = [];
  let inserted = 0;

  await db.withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT full_name FROM winners WHERE event_id = $1',
      [eventId]
    );
    const existingNames = new Set(existingRows.map((w) => normalizeName(w.full_name)));
    const seenNumbers = new Set();

    for (const row of rows) {
      if (!row.full_name || !row.entry_number) {
        skipped.push({ ...row, reason: 'Ad Soyad veya Giriş Numarası eksik' });
        continue;
      }

      if (seenNumbers.has(row.entry_number)) {
        skipped.push({ ...row, reason: 'Numara dosyada tekrar ediyor' });
        continue;
      }
      const { rows: existingNumberRows } = await client.query(
        `SELECT e.name AS event_name FROM winners w
         JOIN events e ON e.id = w.event_id WHERE w.entry_number = $1`,
        [row.entry_number]
      );
      if (existingNumberRows[0]) {
        skipped.push({ ...row, reason: `Numara zaten kayıtlı (${existingNumberRows[0].event_name})` });
        continue;
      }

      const normalized = normalizeName(row.full_name);
      if (existingNames.has(normalized)) {
        skipped.push({ ...row, reason: 'Bu etkinlikte isim zaten kayıtlı' });
        continue;
      }

      await client.query(
        'INSERT INTO winners (event_id, full_name, entry_number) VALUES ($1, $2, $3)',
        [eventId, row.full_name, row.entry_number]
      );
      seenNumbers.add(row.entry_number);
      existingNames.add(normalized);
      inserted += 1;
    }
  });

  return { total: rows.length, inserted, skipped };
}

module.exports = { importExcelForEvent };
