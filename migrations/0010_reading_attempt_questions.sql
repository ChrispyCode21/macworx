-- Which of a passage's questions an attempt carries (SPEC §6.2, §6.10). A reading assignment gives at most
-- READING_QUESTIONS (10) of them, chosen at random when the attempt is made and kept for it. The column holds
-- their ids as a JSON array; NULL means all of the passage's questions, which is every attempt made before this.
-- One added column, so an attempt and its questions are written in one statement.
ALTER TABLE reading_attempts ADD COLUMN questions TEXT;
