CREATE INDEX entities_schedule_due ON entities(kind,json_extract(data,'$.due')) WHERE kind='schedule' AND deleted_at IS NULL;
--> statement-breakpoint
CREATE TABLE platform_audit (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, detail TEXT NOT NULL CHECK(json_valid(detail)), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX platform_audit_time ON platform_audit(created_at);
