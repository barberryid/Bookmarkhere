CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stripe_customer_id TEXT,
  subscription_status TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  description TEXT,
  favicon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_favourite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE (user_id, normalized_url)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  imported_items INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_user_sort ON categories(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_category_sort ON bookmarks(user_id, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_title ON bookmarks(user_id, title);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_created ON import_jobs(user_id, created_at);

INSERT OR IGNORE INTO users (
  id,
  email,
  name,
  created_at,
  updated_at,
  subscription_status
) VALUES (
  'user_private_seed',
  'private@example.com',
  'Private User',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'private'
);

INSERT OR IGNORE INTO categories (id, user_id, name, slug, sort_order) VALUES
  ('cat_uncategorised', 'user_private_seed', 'Uncategorised', 'uncategorised', 0),
  ('cat_travel', 'user_private_seed', 'Travel', 'travel', 10),
  ('cat_hotels', 'user_private_seed', 'Hotels', 'hotels', 20),
  ('cat_design', 'user_private_seed', 'Website Design', 'website-design', 30),
  ('cat_coding', 'user_private_seed', 'Coding', 'coding', 40),
  ('cat_ai', 'user_private_seed', 'AI Tools', 'ai-tools', 50),
  ('cat_finance', 'user_private_seed', 'Finance', 'finance', 60),
  ('cat_personal', 'user_private_seed', 'Personal', 'personal', 70);
