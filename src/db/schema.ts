import {
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  uniqueIndex,
  index,
  integer,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";

// ---------- users ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    // per-user secret for the SMS/email ingest webhook
    webhookToken: text("webhook_token").notNull(),
    // monthly spend budget, stored in paise (₹60,000 default)
    monthlyBudgetPaise: bigint("monthly_budget_paise", { mode: "number" })
      .notNull()
      .default(6_000_000),
    // target asset allocation for the Invest module (percent, sums to 100)
    targetEquityPct: integer("target_equity_pct").notNull().default(60),
    targetDebtPct: integer("target_debt_pct").notNull().default(30),
    targetGoldPct: integer("target_gold_pct").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_webhook_token_idx").on(t.webhookToken),
  ]
);

// ---------- transactions ----------
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // always positive; `type` carries direction
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    type: text("type", { enum: ["debit", "credit"] }).notNull(),
    merchant: text("merchant").notNull().default("Unknown"),
    category: text("category").notNull().default("Other"),
    account: text("account").notNull().default(""),
    channel: text("channel").notNull().default(""), // UPI / CARD / NEFT / ATM / ...
    source: text("source", {
      enum: ["sms", "email", "manual", "demo"],
    }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    rawMessageId: uuid("raw_message_id"),
    // sha256 over the fields that identify a real-world event, for idempotent ingest
    dedupeHash: text("dedupe_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("txn_user_dedupe_idx").on(t.userId, t.dedupeHash),
    index("txn_user_occurred_idx").on(t.userId, t.occurredAt),
  ]
);

// ---------- raw messages (audit trail + review queue) ----------
export const rawMessages = pgTable(
  "raw_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sender: text("sender").notNull().default(""),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    status: text("status", {
      enum: ["parsed", "review", "ignored"],
    }).notNull(),
    parsedTxnId: uuid("parsed_txn_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("raw_user_status_idx").on(t.userId, t.status)]
);

// ---------- learned category corrections ----------
// When the user re-categorizes a transaction and ticks "remember",
// the merchant→category mapping is stored here and overrides the
// built-in keyword categorizer for all future ingests.
export const merchantRules = pgTable(
  "merchant_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    merchant: text("merchant").notNull(), // stored lowercase
    category: text("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("merchant_rules_user_merchant_idx").on(t.userId, t.merchant)]
);

// ---------- mutual funds (M3) ----------
export const funds = pgTable(
  "funds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // mfapi.in scheme code — null for manually-added funds without NAV feed
    schemeCode: text("scheme_code"),
    name: text("name").notNull(),
    assetClass: text("asset_class", {
      enum: ["equity", "debt", "gold", "hybrid"],
    }).notNull(),
    currentNav: doublePrecision("current_nav"), // ₹ per unit, null until first refresh
    navDate: timestamp("nav_date", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("funds_user_idx").on(t.userId)]
);

export const mfTxns = pgTable(
  "mf_txns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["buy", "sell"] }).notNull(),
    units: doublePrecision("units").notNull(),
    nav: doublePrecision("nav").notNull(), // ₹ per unit at transaction time
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mf_txns_fund_idx").on(t.fundId, t.occurredAt)]
);

// ---------- goals (M4) ----------
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetPaise: bigint("target_paise", { mode: "number" }).notNull(),
    targetDate: timestamp("target_date", { withTimezone: true }).notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)]
);

export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("goal_contrib_goal_idx").on(t.goalId)]
);

export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RawMessage = typeof rawMessages.$inferSelect;
export type MerchantRule = typeof merchantRules.$inferSelect;
export type Fund = typeof funds.$inferSelect;
export type MfTxn = typeof mfTxns.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
