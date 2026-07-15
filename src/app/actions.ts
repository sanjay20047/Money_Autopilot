"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { funds, goals, transactions, users } from "@/db/schema";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { buildDemoTransactions, seedDemoPortfolioAndGoals } from "@/lib/demo";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/ratelimit";

// ---------------- auth ----------------

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  invite: z.string().trim().optional(),
});

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    invite: formData.get("invite") ?? undefined,
  });
  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { name, email, password, invite } = parsed.data;

  // when INVITE_CODE is configured, only people you shared it with can sign up
  const requiredInvite = process.env.INVITE_CODE;
  if (requiredInvite && invite !== requiredInvite) {
    recordFailure(`signup:${email}`);
    redirect(`/signup?error=${encodeURIComponent("Invalid invite code")}`);
  }
  if (isRateLimited(`signup:${email}`)) {
    redirect(`/signup?error=${encodeURIComponent("Too many attempts — try again in 15 minutes")}`);
  }

  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with this email already exists")}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const webhookToken = randomBytes(24).toString("base64url");
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, webhookToken })
    .returning({ id: users.id });

  await createSession(user.id);
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password")}`);
  }

  const limitKey = `login:${parsed.data.email}`;
  if (isRateLimited(limitKey)) {
    redirect(`/login?error=${encodeURIComponent("Too many failed attempts — try again in 15 minutes")}`);
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) {
    recordFailure(limitKey);
    redirect(`/login?error=${encodeURIComponent("Incorrect email or password")}`);
  }

  clearFailures(limitKey);
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------------- settings ----------------

export async function updateBudgetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const rupees = Number(String(formData.get("budget") ?? "").replace(/[,\s₹]/g, ""));
  if (Number.isFinite(rupees) && rupees > 0 && rupees <= 10_00_00_000) {
    const db = await getDb();
    await db
      .update(users)
      .set({ monthlyBudgetPaise: Math.round(rupees * 100) })
      .where(eq(users.id, user.id));
  }
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function regenerateTokenAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(users)
    .set({ webhookToken: randomBytes(24).toString("base64url") })
    .where(eq(users.id, user.id));
  revalidatePath("/settings");
  redirect("/settings");
}

// ---------------- demo data ----------------

export async function loadDemoDataAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const rows = buildDemoTransactions(user.id);
  // idempotent: dedupe hashes are stable, so re-running inserts nothing new
  await db.insert(transactions).values(rows).onConflictDoNothing();
  // portfolio + goals (also idempotent — skipped when demo rows exist)
  await seedDemoPortfolioAndGoals(db, user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function clearDemoDataAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await db
    .delete(transactions)
    .where(sql`${transactions.userId} = ${user.id} and ${transactions.source} = 'demo'`);
  // demo funds/goals cascade-delete their txns/contributions
  await db
    .delete(funds)
    .where(sql`${funds.userId} = ${user.id} and ${funds.isDemo} = true`);
  await db
    .delete(goals)
    .where(sql`${goals.userId} = ${user.id} and ${goals.isDemo} = true`);
  revalidatePath("/", "layout");
  redirect("/settings");
}
