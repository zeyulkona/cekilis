const db = require('../db');

// First two letters of first name + first two letters of last name
// (e.g. "Ayşe Kaya" -> "Ay Ka"). Middle names, if any, are ignored.
function maskName(fullName) {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.slice(0, 2)} ${last.slice(0, 2)}`;
}

async function findByEntryNumber(entryNumber) {
  const { rows } = await db.query('SELECT * FROM winners WHERE entry_number = $1', [entryNumber]);
  return rows[0];
}

module.exports = { maskName, findByEntryNumber };
