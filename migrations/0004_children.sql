-- Many children (SPEC §2, §5.3). Add-only: old code keeps running after this migration.
-- The `child` table is left as it is (it keeps CHECK (id = 1)); old code still reads and writes it.

-- One row per child. Balance, streak, last counted day and completed assignments are hers alone,
-- so they live here, with the same types and defaults as `child`.
CREATE TABLE children (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL,
  created_at TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  revision TEXT NOT NULL DEFAULT ''
) STRICT;

-- The existing child becomes child 1, with a placeholder name a parent renames in the app.
INSERT INTO children (id, name, grade, initials, created_at, balance, streak, last_day, completed, revision)
SELECT 1, 'Child', '', 'C', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), balance, streak, last_day, completed, revision
FROM child WHERE id = 1;

-- Everything that exists belongs to child 1 (the default fills existing rows).
ALTER TABLE devices ADD COLUMN child_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE results ADD COLUMN child_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admin_log ADD COLUMN child_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pairing_codes ADD COLUMN child_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX devices_child ON devices (child_id);
CREATE INDEX results_child ON results (child_id, id);
CREATE INDEX admin_log_child ON admin_log (child_id, id);

-- No trigger keeps `children` in step with `child`: D1 counts a trigger's writes in `meta.changes`, and
-- the running Worker checks that it changed exactly 1 row. Until the Worker reads `children`, `child`
-- stays the live copy of balance, streak, last day, completed and revision. The migration that switches
-- the Worker over copies `child` into `children` again.
