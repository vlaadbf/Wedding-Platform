ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected'));
--> statement-breakpoint
ALTER TABLE users ADD COLUMN platform_role TEXT NOT NULL DEFAULT 'user' CHECK(platform_role IN ('user','super_admin'));
--> statement-breakpoint
ALTER TABLE users ADD COLUMN reviewed_by TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE users ADD COLUMN reviewed_at TEXT;
--> statement-breakpoint
CREATE INDEX users_approval_queue ON users(demo,approval_status,created_at);
--> statement-breakpoint
CREATE TABLE account_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), previous_status TEXT NOT NULL, status TEXT NOT NULL, reviewer_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER account_review_history AFTER UPDATE OF approval_status ON users WHEN OLD.approval_status != NEW.approval_status BEGIN INSERT INTO account_reviews(user_id,previous_status,status,reviewer_id,created_at) VALUES(NEW.id,OLD.approval_status,NEW.approval_status,NEW.reviewed_by,NEW.reviewed_at); END;
