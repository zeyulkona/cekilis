CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  pdf_uploaded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  time_label TEXT NOT NULL,
  quota INTEGER NOT NULL CHECK (quota > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, day_label, time_label)
);

-- entry_number is unique system-wide, not per event (see INTENT.md v5):
-- the user-facing entry panel is a single global field with no event
-- pre-selection, so the number alone must resolve to exactly one winner.
CREATE TABLE IF NOT EXISTS winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  entry_number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winner_id INTEGER NOT NULL REFERENCES winners(id),
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  status TEXT NOT NULL CHECK (status IN ('locked', 'claimed', 'expired')),
  locked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_claims_slot ON claims(slot_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_claims_winner ON claims(winner_id);

-- At most one active (locked or claimed) claim per winner, enforced by
-- SQLite itself regardless of application-code correctness.
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_active_winner
  ON claims(winner_id) WHERE status IN ('locked', 'claimed');
