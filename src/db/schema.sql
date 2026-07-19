CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pdf_url TEXT,
  pdf_uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  time_label TEXT NOT NULL,
  quota INTEGER NOT NULL CHECK (quota > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, day_label, time_label)
);

-- entry_number is unique system-wide, not per event (see INTENT.md v5):
-- the user-facing entry panel is a single global field with no event
-- pre-selection, so the number alone must resolve to exactly one winner.
CREATE TABLE IF NOT EXISTS winners (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  entry_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  winner_id INTEGER NOT NULL REFERENCES winners(id),
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  status TEXT NOT NULL CHECK (status IN ('locked', 'claimed', 'expired')),
  locked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_claims_slot ON claims(slot_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_claims_winner ON claims(winner_id);

-- At most one active (locked or claimed) claim per winner, enforced by
-- Postgres itself regardless of application-code correctness.
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_active_winner
  ON claims(winner_id) WHERE status IN ('locked', 'claimed');
