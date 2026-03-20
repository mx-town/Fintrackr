/**
 * Database initialization: creates tables, seeds default user & categories.
 * Safe to call multiple times — uses IF NOT EXISTS / ON CONFLICT.
 */

import { db } from "./index";
import { users, categories } from "./schema";
import { DEFAULT_CATEGORIES } from "./seed-categories";
import { sql } from "drizzle-orm";

const DEFAULT_USER_ID = "local";
const DEFAULT_USER_EMAIL = "local@fintrackr.app";

// Singleton to track initialization
const globalInit = globalThis as unknown as {
  __fintrackr_db_initialized?: Promise<void>;
};

async function initializeDatabase() {
  // Create tables (SQLite — no enums needed)
  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      default_currency TEXT NOT NULL DEFAULT 'EUR',
      locale TEXT NOT NULL DEFAULT 'de-AT',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      bank_name TEXT,
      iban TEXT,
      currency TEXT NOT NULL DEFAULT 'EUR',
      current_balance_cents INTEGER DEFAULT 0,
      color TEXT,
      icon TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      parent_id TEXT,
      name TEXT NOT NULL,
      name_de TEXT,
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size_bytes INTEGER,
      bank_detected TEXT,
      format_detected TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_count INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      error_message TEXT,
      processing_time_ms INTEGER,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      date INTEGER NOT NULL,
      description TEXT NOT NULL,
      raw_description TEXT,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      original_amount_cents INTEGER,
      original_currency TEXT,
      exchange_rate REAL,
      category_source TEXT,
      category_confidence REAL,
      counterparty_name TEXT,
      counterparty_iban TEXT,
      bank_reference TEXT,
      value_date INTEGER,
      hash TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_group_id TEXT,
      notes TEXT,
      is_excluded_from_budget INTEGER DEFAULT 0,
      upload_id TEXT REFERENCES uploads(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      deleted_at INTEGER
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (transaction_id, tag_id)
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      currency TEXT NOT NULL DEFAULT 'EUR',
      is_active INTEGER NOT NULL DEFAULT 1,
      alert_threshold REAL DEFAULT 0.8,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS categorization_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      match_type TEXT NOT NULL,
      match_value TEXT NOT NULL,
      match_field TEXT NOT NULL DEFAULT 'description',
      is_auto_learned INTEGER NOT NULL DEFAULT 0,
      hit_count INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));

  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY,
      date INTEGER NOT NULL,
      base_currency TEXT NOT NULL DEFAULT 'EUR',
      target_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'ecb'
    )
  `));

  // Create indexes
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts(user_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS categories_user_idx ON categories(user_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories(parent_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, date)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS transactions_user_category_idx ON transactions(user_id, category_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS transactions_user_type_idx ON transactions(user_id, type)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS transactions_hash_idx ON transactions(hash)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS transactions_recurring_idx ON transactions(recurring_group_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS budgets_user_idx ON budgets(user_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS tags_user_name_idx ON tags(user_id, name)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS rules_user_idx ON categorization_rules(user_id)`));
  db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS rates_date_pair_idx ON exchange_rates(date, base_currency, target_currency)`));

  // Seed default user
  db.insert(users)
    .values({
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: "Local User",
    })
    .onConflictDoNothing()
    .run();

  // Seed categories
  for (const cat of DEFAULT_CATEGORIES) {
    db.insert(categories)
      .values({
        id: cat.id,
        userId: null,
        parentId: "parentId" in cat ? (cat as { parentId: string }).parentId : null,
        name: cat.name,
        nameDE: cat.nameDE,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isSystem: true,
      })
      .onConflictDoNothing()
      .run();
  }

  console.log("[DB] Initialized successfully (SQLite)");
}

export function ensureDb(): Promise<void> {
  if (!globalInit.__fintrackr_db_initialized) {
    globalInit.__fintrackr_db_initialized = Promise.resolve(initializeDatabase());
  }
  return globalInit.__fintrackr_db_initialized;
}

export { DEFAULT_USER_ID };
