CREATE TABLE integration_settings (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT, iv TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_by TEXT REFERENCES users(id), updated_at TEXT);
--> statement-breakpoint
INSERT INTO integration_settings(id) VALUES(1);
--> statement-breakpoint
CREATE TABLE integration_settings_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, revision INTEGER NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER integration_settings_history AFTER UPDATE ON integration_settings BEGIN INSERT INTO integration_settings_audit(revision,actor_id,created_at) VALUES(NEW.revision,NEW.updated_by,NEW.updated_at); END;
