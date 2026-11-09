-- The mix a math result was scored against (SPEC §6.8). JSON text like `answers` and `detail`: the picks as
-- [{"operation":"division","level":"easy"}], in the order she picked them. NULL is the fixed mix of SPEC §6.1:
-- every result recorded before mixes existed, and any result sent without a mix. Reading results have none.
-- Additive: the running Worker's INSERT names its columns, so it leaves this one NULL.
ALTER TABLE results ADD COLUMN mix TEXT CHECK (mix IS NULL OR json_valid(mix));
