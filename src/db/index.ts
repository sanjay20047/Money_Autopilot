// Database client.
//
// Dev:  PGlite — a real embedded Postgres, zero setup, persisted to ./.data/pg
// Prod: Neon (free tier) — set DATABASE_URL and the same schema/queries run
//       over the serverless HTTP driver.

import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;

// Schema is applied idempotently at startup — no migration CLI needed.
const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  webhook_token text NOT NULL,
  monthly_budget_paise bigint NOT NULL DEFAULT 6000000,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_webhook_token_idx ON users (webhook_token);
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_equity_pct integer NOT NULL DEFAULT 60;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_debt_pct integer NOT NULL DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_gold_pct integer NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL,
  type text NOT NULL,
  merchant text NOT NULL DEFAULT 'Unknown',
  category text NOT NULL DEFAULT 'other',
  account text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT '',
  source text NOT NULL,
  occurred_at timestamptz NOT NULL,
  raw_message_id uuid,
  dedupe_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS txn_user_dedupe_idx ON transactions (user_id, dedupe_hash);
CREATE INDEX IF NOT EXISTS txn_user_occurred_idx ON transactions (user_id, occurred_at);

CREATE TABLE IF NOT EXISTS raw_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT '',
  body text NOT NULL,
  received_at timestamptz NOT NULL,
  status text NOT NULL,
  parsed_txn_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raw_user_status_idx ON raw_messages (user_id, status);

CREATE TABLE IF NOT EXISTS merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_rules_user_merchant_idx ON merchant_rules (user_id, merchant);

CREATE TABLE IF NOT EXISTS funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme_code text,
  name text NOT NULL,
  asset_class text NOT NULL,
  current_nav double precision,
  nav_date timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funds_user_idx ON funds (user_id);

CREATE TABLE IF NOT EXISTS mf_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fund_id uuid NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  type text NOT NULL,
  units double precision NOT NULL,
  nav double precision NOT NULL,
  amount_paise bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mf_txns_fund_idx ON mf_txns (fund_id, occurred_at);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_paise bigint NOT NULL,
  target_date timestamptz NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_user_idx ON goals (user_id);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_contrib_goal_idx ON goal_contributions (goal_id);
`;

// Cache across HMR reloads in dev — a second PGlite instance on the same
// data dir would fail to acquire the file lock.
const g = globalThis as unknown as { __moneyDb?: Promise<Db> };

async function applyDdl(db: Db): Promise<void> {
  // executed statement-by-statement so it works on drivers without
  // multi-statement support (Neon HTTP)
  for (const stmt of DDL.split(/;\s*(?:\r?\n|$)/)) {
    const trimmed = stmt.trim();
    if (trimmed) await db.execute(sql.raw(trimmed));
  }
}

async function init(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    // Production: Neon serverless Postgres. The drizzle API surface we use
    // (select/insert/update/delete/execute) is identical across drivers,
    // so we present it under the same Db type.
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle: drizzleNeon } = await import("drizzle-orm/neon-http");
    const client = neon(process.env.DATABASE_URL);
    const db = drizzleNeon(client, { schema }) as unknown as Db;
    await applyDdl(db);
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? "./.data/pg";
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await applyDdl(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__moneyDb) {
    // never cache a failed init — otherwise one bad start poisons every
    // later request until the process restarts
    g.__moneyDb = init().catch((err) => {
      g.__moneyDb = undefined;
      throw err;
    });
  }
  return g.__moneyDb;
}
