-- The highest id ever given to a passage or a reading attempt, kept past the rows' own deletion (SPEC §6.10). Editing
-- and deleting a passage (issue #254) removes passages and attempts, and a reused id would let an iPad holding an
-- old attempt be matched with other questions, or give a new passage a deleted passage's picture name and so its
-- cached picture. The Worker gives a new row the id after the higher of its table's largest id and this floor, and
-- raises the floor in the same batch that removes rows. Add-only: nothing that exists is touched.
CREATE TABLE id_floor (
  name TEXT PRIMARY KEY CHECK (name IN ('passages', 'reading_attempts')),
  value INTEGER NOT NULL CHECK (value >= 0)
) STRICT;
