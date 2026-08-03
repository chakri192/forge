-- Public portfolio profiles
-- Opt-in, revocable, and addressed by a slug rather than the internal id so
-- a public URL never leaks a primary key.

ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN public_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_slug ON users(public_slug);
