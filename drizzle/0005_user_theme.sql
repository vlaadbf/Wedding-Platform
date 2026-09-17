ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'sand' CHECK(theme IN ('sand','sage','rose','ocean'));
