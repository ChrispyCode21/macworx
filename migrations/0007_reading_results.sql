-- Reading attempts and results (SPEC §6.8). `results` is rebuilt so one table holds every kind of
-- assignment: a math result is tied to a seed, a reading result to an attempt. This is the one migration
-- that rebuilds a table instead of adding to it (owner decision, issue #208): ids and every column are
-- copied, and the old Worker keeps working against the new table, because its INSERT names its columns
-- (kind, attempt and detail take their defaults) and its reads name columns or take the whole row.
-- D1 rejects BEGIN/COMMIT and always enforces foreign keys, so the rebuild defers them to the end of the batch.

PRAGMA defer_foreign_keys = true;

-- An attempt at a passage: handed out when she starts Reading, used by at most one result.
CREATE TABLE reading_attempts (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices (id),
  child_id INTEGER NOT NULL REFERENCES children (id),
  passage_id INTEGER NOT NULL REFERENCES passages (id),
  issued_day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1))
) STRICT;

CREATE INDEX reading_attempts_unused ON reading_attempts (device_id, used);
-- Her next passage joins her reading results to their attempts' passages (SPEC §6.10).
CREATE INDEX reading_attempts_child_passage ON reading_attempts (child_id, passage_id);

-- A reading result keeps in `answers` her picks as JSON, in `answered` the number of questions, in `correct`
-- the questions she got right, and in `detail` the passage's title and each question's text, choices, her
-- choice and the right choice as they were when it was recorded (SPEC §6.8, D14).
CREATE TABLE results_new (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'math' CHECK (kind IN ('math', 'reading')),
  seed INTEGER UNIQUE REFERENCES seeds (seed),
  attempt INTEGER UNIQUE REFERENCES reading_attempts (id),
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
  CHECK (
    (kind = 'math' AND seed IS NOT NULL AND attempt IS NULL AND detail IS NULL)
    OR (kind = 'reading' AND seed IS NULL AND attempt IS NOT NULL AND detail IS NOT NULL)
  )
) STRICT;

INSERT INTO results_new (id, seed, device_id, day, answers, answered, correct, finished, grade, base,
  accuracy_bonus, streak_bonus, total, created_at, child_id)
SELECT id, seed, device_id, day, answers, answered, correct, finished, grade, base,
  accuracy_bonus, streak_bonus, total, created_at, child_id
FROM results;

DROP TABLE results;
ALTER TABLE results_new RENAME TO results;
CREATE INDEX results_child ON results (child_id, id);
