-- Pairing codes (SPEC §6.9). Only the newest usable code counts; making a new one voids the others.
-- The code is stored as its SHA-256. With only a million possible codes that adds little protection;
-- what protects a code is its 10-minute life, one use and 5 tries.
CREATE TABLE pairing_codes (
  id INTEGER PRIMARY KEY,
  code_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  voided_at TEXT,
  -- A random value set by the request that uses the code, so only that request creates the device.
  claim TEXT
) STRICT;
