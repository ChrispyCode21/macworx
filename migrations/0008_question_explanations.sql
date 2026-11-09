-- A question's explanation (SPEC §6.10): why the right choice is right, shown to her only after she has
-- checked. Add-only, so the Worker already running keeps working; existing questions get ''.
ALTER TABLE questions ADD COLUMN explanation TEXT NOT NULL DEFAULT '';
