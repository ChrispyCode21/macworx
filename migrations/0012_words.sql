-- The spelling words a parent adds (SPEC §6.11). Shared by every child. `key` is the word as the engine compares it
-- (trimmed, capitals ignored, curly apostrophes and accent forms read the same), so "Friend" and "friend" are one word
-- and the unique key is what skips a duplicate. `alternates` is a JSON array of the other spellings that are also right.
-- `grade` is kept for later; nothing reads it yet.
CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  word TEXT NOT NULL CHECK (length(word) > 0),
  key TEXT NOT NULL UNIQUE CHECK (length(key) > 0),
  sentence TEXT NOT NULL DEFAULT '',
  alternates TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(alternates)),
  grade INTEGER,
  created_at TEXT NOT NULL
) STRICT;
