-- The Worker now reads and writes each child's numbers on her `children` row, not on `child`.
-- Copy the live numbers over once more: `child` was the live copy until this migration (see 0004).
-- Only the numbers are copied; name, grade, initials and created_at stay as the parent set them.
-- `child` stays in the schema, unread.
UPDATE children SET
  balance = (SELECT balance FROM child WHERE id = 1),
  streak = (SELECT streak FROM child WHERE id = 1),
  last_day = (SELECT last_day FROM child WHERE id = 1),
  completed = (SELECT completed FROM child WHERE id = 1),
  revision = (SELECT revision FROM child WHERE id = 1)
WHERE id = 1;
