-- macworx's first schema (SPEC §6.8). STRICT tables; one child row.

-- A paired iPad. Only the SHA-256 of its key is stored.
CREATE TABLE devices (
  id INTEGER PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;

-- Seeds the Worker handed out; each is used by one result at most.
CREATE TABLE seeds (
  seed INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices (id),
  issued_day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1))
) STRICT;

CREATE INDEX seeds_unused ON seeds (device_id, used);

-- One recorded assignment, finished or left early, as the Worker re-scored it.
CREATE TABLE results (
  id INTEGER PRIMARY KEY,
  seed INTEGER NOT NULL UNIQUE REFERENCES seeds (seed),
  device_id INTEGER NOT NULL REFERENCES devices (id),
  day TEXT NOT NULL,
  answers TEXT NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  finished INTEGER NOT NULL CHECK (finished IN (0, 1)),
  grade TEXT,
  base INTEGER NOT NULL,
  accuracy_bonus INTEGER NOT NULL,
  streak_bonus INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

-- Her totals. A parent restores a broken streak by editing streak and last_day here.
-- revision changes on every write, so two writes can't both apply from the same starting point.
CREATE TABLE child (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  balance INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  revision TEXT NOT NULL DEFAULT ''
) STRICT;

INSERT INTO child (id) VALUES (1);
