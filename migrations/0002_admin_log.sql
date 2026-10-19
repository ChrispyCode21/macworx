-- Every change a parent makes in admin mode (SPEC §5.3): what changed, when, and which parent made it.
CREATE TABLE admin_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}'
) STRICT;
