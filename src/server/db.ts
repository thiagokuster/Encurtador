import fs from "fs";
import path from "path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const globalDb = globalThis as unknown as { __encurtadorDb?: DatabaseSync };

const SCHEMA = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'password' CHECK (provider IN ('password', 'google')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  domain TEXT,
  analytics_enabled INTEGER NOT NULL DEFAULT 1 CHECK (analytics_enabled IN (0, 1)),
  retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 1 AND 3650),
  default_redirect INTEGER NOT NULL DEFAULT 302 CHECK (default_redirect IN (301, 302)),
  link_limit INTEGER NOT NULL DEFAULT 500 CHECK (link_limit BETWEEN 1 AND 2000),
  updated_at INTEGER NOT NULL
);

CREATE TABLE app_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  original_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  redirect_type INTEGER NOT NULL DEFAULT 302 CHECK (redirect_type IN (301, 302)),
  expires_at INTEGER,
  password_hash TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  qr_color TEXT NOT NULL DEFAULT '1C1915',
  qr_background TEXT NOT NULL DEFAULT 'FFFCF8',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_links_user_created ON links(user_id, created_at DESC);
CREATE INDEX idx_links_user_clicks ON links(user_id, click_count DESC);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (user_id, name)
);
CREATE INDEX idx_tags_user ON tags(user_id);

CREATE TABLE link_tags (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);

CREATE TABLE click_events (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clicked_at INTEGER NOT NULL,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  referrer_host TEXT,
  referrer_category TEXT,
  visitor_hash TEXT
);
CREATE INDEX idx_clicks_user_time ON click_events(user_id, clicked_at);
CREATE INDEX idx_clicks_link_time ON click_events(link_id, clicked_at);
CREATE INDEX idx_clicks_dedupe ON click_events(link_id, visitor_hash, clicked_at);

CREATE TABLE security_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_security_logs_created ON security_logs(created_at DESC);
CREATE INDEX idx_security_logs_user ON security_logs(user_id, created_at DESC);
`;

function migrate(db: DatabaseSync) {
  const current = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  let version = current?.user_version ?? 0;
  if (version < 1) {
    db.exec("BEGIN");
    try {
      db.exec(SCHEMA);
      db.prepare("INSERT INTO app_flags (key, value) VALUES ('registration_open', '1')").run();
      db.exec("COMMIT");
      version = 1;
      db.exec("PRAGMA user_version = 1");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* a falha de rollback não esconde o erro original */
      }
      throw error;
    }
  }
  if (version < 2) {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "provider")) {
      db.exec("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'password'");
    }
    db.exec("PRAGMA user_version = 2");
  }
}

export function getDb() {
  if (!globalDb.__encurtadorDb) {
    const directory = path.join(process.cwd(), "data");
    fs.mkdirSync(directory, { recursive: true });
    const db = new DatabaseSync(path.join(directory, "encurtador.sqlite"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 4000");
    migrate(db);
    globalDb.__encurtadorDb = db;
  }
  return globalDb.__encurtadorDb;
}

export function one<T>(sql: string, ...params: SQLInputValue[]) {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function many<T>(sql: string, ...params: SQLInputValue[]) {
  return getDb().prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* mantém o erro original */
    }
    throw error;
  }
}
