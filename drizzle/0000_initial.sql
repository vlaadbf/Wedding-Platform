CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT, verified INTEGER NOT NULL DEFAULT 0, demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_tokens (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS workspace_members (workspace_id TEXT NOT NULL REFERENCES workspaces(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS event_members (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, grants TEXT NOT NULL DEFAULT '{}', shared_ids TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(event_id,user_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS team_invites (hash TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), email TEXT NOT NULL, role TEXT NOT NULL, grants TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, kind TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1, author_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(event_id,id));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entity_event_kind ON entities(event_id,kind,deleted_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS entity_links (event_id TEXT NOT NULL, source_id TEXT NOT NULL, field TEXT NOT NULL, target_id TEXT NOT NULL, PRIMARY KEY(event_id,source_id,field), FOREIGN KEY(event_id,source_id) REFERENCES entities(event_id,id) ON DELETE CASCADE, FOREIGN KEY(event_id,target_id) REFERENCES entities(event_id,id));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entity_link_target ON entity_links(event_id,target_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS unique_guest_subevent ON entities(event_id,json_extract(data,'$.guest_id'),json_extract(data,'$.subevent_id'),kind) WHERE kind IN ('rsvp','guest_invitation','checkin') AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS unique_seat ON entities(event_id,json_extract(data,'$.table_id'),json_extract(data,'$.seat')) WHERE kind='assignment' AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS unique_guest_plan ON entities(event_id,json_extract(data,'$.guest_id'),json_extract(data,'$.subevent_id')) WHERE kind='assignment' AND deleted_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), expected_version INTEGER NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS event_revision_guard BEFORE INSERT ON mutations BEGIN SELECT CASE WHEN (SELECT version FROM events WHERE id=NEW.event_id) != NEW.expected_version THEN RAISE(ABORT,'VERSION_CONFLICT') END; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS event_revision_increment AFTER INSERT ON mutations BEGIN UPDATE events SET version=version+1,updated_at=NEW.created_at WHERE id=NEW.event_id; END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS access_tokens (hash TEXT PRIMARY KEY, event_id TEXT NOT NULL, household_id TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT, FOREIGN KEY(event_id,household_id) REFERENCES entities(event_id,id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, campaign_id TEXT, household_id TEXT, channel TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, due_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempt INTEGER NOT NULL DEFAULT 0, locked_at TEXT, provider_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(event_id,campaign_id,household_id));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,due_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS message_attempts (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), status TEXT NOT NULL, code TEXT, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS webhook_events (provider TEXT NOT NULL, id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(provider,id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_event_time ON audit(event_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, storage_key TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, author_id TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
