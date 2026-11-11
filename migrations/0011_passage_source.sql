-- The JSON a parent pasted for a passage, kept whole so every field in it survives (SPEC §6.10). NULL for a passage
-- added by hand (scripts/passage-sql.mjs). One added column; nothing reads it back yet.
ALTER TABLE passages ADD COLUMN source TEXT;
