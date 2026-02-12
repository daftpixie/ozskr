-- Add nonce column to sessions table for replay attack prevention
-- Each SIWS nonce can only be used once

ALTER TABLE sessions ADD COLUMN nonce TEXT;
CREATE UNIQUE INDEX idx_sessions_nonce ON sessions(nonce) WHERE nonce IS NOT NULL;

COMMENT ON COLUMN sessions.nonce IS 'SIWS nonce used during authentication — unique to prevent replay attacks';
