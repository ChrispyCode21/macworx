-- Reading passages (SPEC §6.10). Add-only: nothing that exists is touched, so old code keeps running.
-- The owner adds rows by hand from a SQL file with explicit ids, the same on preview and production;
-- no passage text is in the repo. Her next passage is the lowest id she hasn't finished (SPEC §6.10).

CREATE TABLE passages (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) > 0),
  genre TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL CHECK (minutes >= 1),
  hint TEXT NOT NULL DEFAULT '',
  -- The text; paragraphs are separated by a blank line.
  body TEXT NOT NULL CHECK (length(body) > 0),
  -- The picture's name in R2 (the passage id, a dot and an extension, for example '3.webp'), or NULL for none.
  image TEXT CHECK (image IS NULL OR image GLOB CAST(id AS TEXT) || '.*')
) STRICT;

CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  passage_id INTEGER NOT NULL REFERENCES passages (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  text TEXT NOT NULL CHECK (length(text) > 0),
  UNIQUE (passage_id, position)
) STRICT;

CREATE TABLE choices (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions (id),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  text TEXT NOT NULL CHECK (length(text) > 0),
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct IN (0, 1)),
  UNIQUE (question_id, position)
) STRICT;

-- At most one right choice per question. "Exactly four choices and exactly one right" can't be a CHECK
-- (it needs a trigger, and D1 counts a trigger's writes in `meta.changes`), so the seed script checks it (issue #213), and what the Worker does with a passage that fails it is issue #214.
CREATE UNIQUE INDEX choices_one_correct ON choices (question_id) WHERE correct = 1;
