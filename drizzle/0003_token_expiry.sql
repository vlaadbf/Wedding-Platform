ALTER TABLE access_tokens ADD COLUMN expires_at TEXT;
--> statement-breakpoint
UPDATE access_tokens SET expires_at=datetime(created_at,'+400 days') WHERE expires_at IS NULL;
--> statement-breakpoint
CREATE INDEX access_tokens_active_expiry ON access_tokens(hash,expires_at) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE maintenance (key TEXT PRIMARY KEY, ran_at TEXT NOT NULL);
