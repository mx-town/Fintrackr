import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// ============================================================
// ENUMS (SQLite has no native enums — use text with TS types)
// ============================================================

export type TransactionType = "income" | "expense" | "transfer";
export type CategorizationSource = "user" | "rule" | "keyword" | "ai" | "import";
export type UploadStatus = "pending" | "processing" | "completed" | "failed";
export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

// ============================================================
// USERS
// ============================================================

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  defaultCurrency: text("default_currency").default("EUR").notNull(),
  locale: text("locale").default("de-AT").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ============================================================
// ACCOUNTS (Bank accounts)
// ============================================================

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bankName: text("bank_name"),
    iban: text("iban"),
    currency: text("currency").default("EUR").notNull(),
    currentBalanceCents: integer("current_balance_cents").default(0),
    color: text("color"),
    icon: text("icon"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("accounts_user_idx").on(table.userId)]
);

// ============================================================
// CATEGORIES (hierarchical — parent/child)
// ============================================================

export const categories = sqliteTable(
  "categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    nameDE: text("name_de"),
    icon: text("icon"),
    color: text("color"),
    sortOrder: integer("sort_order").default(0),
    isSystem: integer("is_system", { mode: "boolean" }).default(false).notNull(),
    isHidden: integer("is_hidden", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("categories_user_idx").on(table.userId),
    index("categories_parent_idx").on(table.parentId),
  ]
);

// ============================================================
// UPLOADS (file processing tracking)
// ============================================================

export const uploads = sqliteTable("uploads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => accounts.id),

  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  bankDetected: text("bank_detected"),
  formatDetected: text("format_detected"),

  status: text("status").$type<UploadStatus>().default("pending").notNull(),
  transactionCount: integer("transaction_count").default(0),
  duplicateCount: integer("duplicate_count").default(0),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),

  periodStart: integer("period_start", { mode: "timestamp" }),
  periodEnd: integer("period_end", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ============================================================
// TRANSACTIONS (the core entity)
// ============================================================

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    // Core fields
    date: integer("date", { mode: "timestamp" }).notNull(),
    description: text("description").notNull(),
    rawDescription: text("raw_description"),
    type: text("type").$type<TransactionType>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("EUR").notNull(),

    // Multi-currency support
    originalAmountCents: integer("original_amount_cents"),
    originalCurrency: text("original_currency"),
    exchangeRate: real("exchange_rate"),

    // Categorization metadata
    categorySource: text("category_source").$type<CategorizationSource>(),
    categoryConfidence: real("category_confidence"),

    // Counterparty
    counterpartyName: text("counterparty_name"),
    counterpartyIban: text("counterparty_iban"),

    // Bank reference data
    bankReference: text("bank_reference"),
    valueDate: integer("value_date", { mode: "timestamp" }),

    // Deduplication
    hash: text("hash"),

    // Recurring detection
    isRecurring: integer("is_recurring", { mode: "boolean" }).default(false),
    recurringGroupId: text("recurring_group_id"),

    // User notes
    notes: text("notes"),
    isExcludedFromBudget: integer("is_excluded_from_budget", { mode: "boolean" }).default(false),

    // Metadata
    uploadId: text("upload_id").references(() => uploads.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_user_category_idx").on(
      table.userId,
      table.categoryId
    ),
    index("transactions_user_type_idx").on(table.userId, table.type),
    index("transactions_hash_idx").on(table.hash),
    index("transactions_recurring_idx").on(table.recurringGroupId),
  ]
);

// ============================================================
// TRANSACTION TAGS (many-to-many)
// ============================================================

export const tags = sqliteTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("tags_user_name_idx").on(table.userId, table.name)]
);

export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.tagId] }),
  ]
);

// ============================================================
// BUDGETS
// ============================================================

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),

    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    period: text("period").$type<BudgetPeriod>().default("monthly").notNull(),
    currency: text("currency").default("EUR").notNull(),

    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    alertThreshold: real("alert_threshold").default(0.8),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("budgets_user_idx").on(table.userId)]
);

// ============================================================
// CATEGORIZATION RULES (user-defined + auto-learned)
// ============================================================

export const categorizationRules = sqliteTable(
  "categorization_rules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    matchType: text("match_type").notNull(),
    matchValue: text("match_value").notNull(),
    matchField: text("match_field").default("description").notNull(),

    isAutoLearned: integer("is_auto_learned", { mode: "boolean" }).default(false).notNull(),
    hitCount: integer("hit_count").default(0),
    priority: integer("priority").default(0),

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("rules_user_idx").on(table.userId)]
);

// ============================================================
// EXCHANGE RATES CACHE
// ============================================================

export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    date: integer("date", { mode: "timestamp" }).notNull(),
    baseCurrency: text("base_currency").default("EUR").notNull(),
    targetCurrency: text("target_currency").notNull(),
    rate: real("rate").notNull(),
    source: text("source").default("ecb").notNull(),
  },
  (table) => [
    uniqueIndex("rates_date_pair_idx").on(
      table.date,
      table.baseCurrency,
      table.targetCurrency
    ),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
  categories: many(categories),
  budgets: many(budgets),
  tags: many(tags),
  uploads: many(uploads),
  rules: many(categorizationRules),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(
  categories,
  ({ one, many }) => ({
    user: one(users, {
      fields: [categories.userId],
      references: [users.id],
    }),
    parent: one(categories, {
      fields: [categories.parentId],
      references: [categories.id],
      relationName: "parentChild",
    }),
    children: many(categories, { relationName: "parentChild" }),
    transactions: many(transactions),
    budgets: many(budgets),
  })
);

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [transactions.userId],
      references: [users.id],
    }),
    account: one(accounts, {
      fields: [transactions.accountId],
      references: [accounts.id],
    }),
    category: one(categories, {
      fields: [transactions.categoryId],
      references: [categories.id],
    }),
    upload: one(uploads, {
      fields: [transactions.uploadId],
      references: [uploads.id],
    }),
    tags: many(transactionTags),
  })
);

export const transactionTagsRelations = relations(
  transactionTags,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionTags.transactionId],
      references: [transactions.id],
    }),
    tag: one(tags, {
      fields: [transactionTags.tagId],
      references: [tags.id],
    }),
  })
);
