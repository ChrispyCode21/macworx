-- Spelling attempts and results (SPEC §6.8, §6.11). `results` is rebuilt, as 0007 did, because its `kind` CHECK
-- allows only math and reading: ids and every column are copied, and the old Worker keeps working against the new
-- table, because its INSERTs name their columns (the new one takes its default). D1 rejects BEGIN/COMMIT and always
-- enforces foreign keys, so the rebuild defers them to the end of the batch.

PRAGMA defer_foreign_keys = true;

-- An attempt at some words: handed out when she starts Spelling, used by at most one result. `words` holds the
-- word ids as a JSON array, in the order she gets them. An edit or delete of a word removes the unused attempts
-- that hold it (SPEC §6.11), so an attempt with a result is never removed. AUTOINCREMENT: the number of a removed
-- attempt is never given to a new one, so an iPad holding the old one can't be matched with other words.
CREATE TABLE spelling_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices (id),
  child_id INTEGER NOT NULL REFERENCES children (id),
  issued_day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
  words TEXT NOT NULL CHECK (json_valid(words) AND json_type(words) = 'array')
) STRICT;

CREATE INDEX spelling_attempts_unused ON spelling_attempts (device_id, used);

-- A spelling result keeps in `answers` what she typed as a JSON array, in `answered` the number of words, in `correct`
-- the words she got right, and in `detail` each word with its sentence, alternates, her typing and whether it
-- matched, as they were when it was recorded (SPEC §6.8, D15). `spelling_attempt` is its own column, not `attempt`,
-- which points at reading_attempts: the two tables number their attempts separately.
CREATE TABLE results_new (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'math' CHECK (kind IN ('math', 'reading', 'spelling')),
  seed INTEGER UNIQUE REFERENCES seeds (seed),
  attempt INTEGER UNIQUE REFERENCES reading_attempts (id),
  spelling_attempt INTEGER UNIQUE REFERENCES spelling_attempts (id),
  detail TEXT,
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
  created_at TEXT NOT NULL,
  child_id INTEGER NOT NULL DEFAULT 1,
  mix TEXT CHECK (mix IS NULL OR json_valid(mix)),
  CHECK (
    (kind = 'math' AND seed IS NOT NULL AND attempt IS NULL AND spelling_attempt IS NULL AND detail IS NULL)
    OR (kind = 'reading' AND seed IS NULL AND attempt IS NOT NULL AND spelling_attempt IS NULL AND detail IS NOT NULL)
    OR (kind = 'spelling' AND seed IS NULL AND attempt IS NULL AND spelling_attempt IS NOT NULL AND detail IS NOT NULL)
  )
) STRICT;

INSERT INTO results_new (id, kind, seed, attempt, detail, device_id, day, answers, answered, correct, finished,
  grade, base, accuracy_bonus, streak_bonus, total, created_at, child_id, mix)
SELECT id, kind, seed, attempt, detail, device_id, day, answers, answered, correct, finished,
  grade, base, accuracy_bonus, streak_bonus, total, created_at, child_id, mix
FROM results;

DROP TABLE results;
ALTER TABLE results_new RENAME TO results;
CREATE INDEX results_child ON results (child_id, id);
