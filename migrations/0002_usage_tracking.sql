-- Usage tracking for the generated "Most Used" section.
-- open_count / last_opened_at give cheap headline numbers; bookmark_opens is an
-- append-only event log so 30/90-day visit windows can be computed on demand.

ALTER TABLE bookmarks ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN last_opened_at TEXT;

CREATE TABLE IF NOT EXISTS bookmark_opens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bookmark_id TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmark_opens_user_opened ON bookmark_opens(user_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_bookmark_opens_bookmark ON bookmark_opens(bookmark_id, opened_at);
