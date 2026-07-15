import { requireUser } from "@/lib/auth";
import {
  getCurrentMonthStats,
  getCategorySplit,
  getRecentTransactions,
  getReviewCount,
} from "@/lib/data";
import { categoryDef, CATEGORY_LIST } from "@/lib/categories";
import { fmt, fmtCompact } from "@/lib/money";
import { Card, CardLabel, Chip, EmptyNote } from "@/components/ui";
import { EditableTxnRow } from "@/components/txn-editable";
import { Donut, Meter } from "@/components/charts";
import { addManualTxnAction } from "@/app/actions-txns";
import type { Transaction } from "@/db/schema";

export const metadata = { title: "Spends" };

const field =
  "rounded-lg border border-hairline bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

function groupByDay(txns: Transaction[]): Array<[string, Transaction[]]> {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const d = new Date(t.occurredAt);
    const key = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return [...map.entries()];
}

export default async function SpendsPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await props.searchParams;
  const now = new Date();

  const [stats, split, txns, reviewCount] = await Promise.all([
    getCurrentMonthStats(user.id),
    getCategorySplit(user.id),
    getRecentTransactions(user.id, 60),
    getReviewCount(user.id),
  ]);

  const budget = user.monthlyBudgetPaise;
  const burnPct = budget > 0 ? Math.round((stats.spentPaise / budget) * 100) : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const perDayLeft = Math.max(0, Math.floor((budget - stats.spentPaise) / daysLeft));

  const groups = groupByDay(txns);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-lg font-bold tracking-tight">Spends</h1>
        <span className="text-[11px] font-medium text-ink-3">
          {now.toLocaleDateString("en-IN", { month: "long" })} · {daysLeft} days left
        </span>
      </header>

      {error && (
        <p className="rounded-2xl bg-serious-soft px-4 py-3 text-sm font-medium text-serious">
          {error}
        </p>
      )}

      {reviewCount > 0 && (
        <div className="rounded-2xl border border-hairline bg-warn-soft px-4 py-3 text-[13px] font-medium text-warn">
          {reviewCount} message{reviewCount > 1 ? "s" : ""} couldn&apos;t be parsed
          automatically — review support lands shortly.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardLabel>Monthly budget</CardLabel>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-2xl font-extrabold tracking-tight">
              {fmt(stats.spentPaise)}
            </span>
            <span className="text-xs text-ink-2">of {fmt(budget)}</span>
          </div>
          <Meter pct={burnPct} className="mt-3" />
          <div className="mt-2 flex justify-between text-[11px] text-ink-2">
            <span>
              {burnPct}% used · day {now.getDate()} of {daysInMonth}
            </span>
            <span className="tnum font-bold text-ink">{fmtCompact(perDayLeft)}/day left</span>
          </div>
          {burnPct > 100 && (
            <div className="mt-3">
              <Chip tone="serious">! Over budget by {fmt(stats.spentPaise - budget)}</Chip>
            </div>
          )}
        </Card>

        <Card>
          <CardLabel>Where it went</CardLabel>
          {split.length === 0 ? (
            <EmptyNote>No spends recorded this month yet.</EmptyNote>
          ) : (
            <div className="mt-1 flex items-center gap-4">
              <Donut
                slices={split.map((s) => ({
                  value: s.totalPaise,
                  color: categoryDef(s.category).color,
                }))}
                centerTitle={fmtCompact(stats.spentPaise)}
                centerSub={`${split.length} categories`}
                ariaLabel="Spend by category this month"
              />
              <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                {split.map((s) => {
                  const def = categoryDef(s.category);
                  return (
                    <li key={s.category} className="flex items-center gap-2 text-[12px]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: def.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-2">
                        {def.label}
                      </span>
                      <span className="tnum font-bold text-ink">
                        {fmtCompact(s.totalPaise)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardLabel>Transactions</CardLabel>
          <span className="text-[11px] text-ink-3">tap a row to edit</span>
        </div>

        <details className="mb-1 mt-1">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-brand">
            + Add manually (cash spends, anything SMS missed)
          </summary>
          <form
            action={addManualTxnAction}
            className="mt-2 grid grid-cols-2 gap-2.5 rounded-xl bg-surface p-3 md:grid-cols-5"
          >
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Type
              <select className={field} name="type" defaultValue="debit">
                <option value="debit">Spent</option>
                <option value="credit">Received</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Amount (₹)
              <input className={field} type="number" name="amount" min="0.01" step="0.01" required />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Merchant / note
              <input className={field} type="text" name="merchant" placeholder="Tea shop" required />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Category
              <select className={field} name="category" defaultValue="other">
                {CATEGORY_LIST.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Date
              <input
                className={field}
                type="date"
                name="date"
                defaultValue={now.toISOString().slice(0, 10)}
                required
              />
            </label>
            <button
              type="submit"
              className="col-span-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white md:col-span-5 md:justify-self-end md:px-6"
            >
              Add transaction
            </button>
          </form>
        </details>

        {groups.length === 0 ? (
          <EmptyNote>
            Nothing here yet — connect the SMS webhook in Settings or load demo data from Home.
          </EmptyNote>
        ) : (
          groups.map(([day, list]) => (
            <div key={day}>
              <div className="mt-3 border-b border-hairline pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">
                {day}
              </div>
              <div className="divide-y divide-hairline">
                {list.map((t) => (
                  <EditableTxnRow key={t.id} txn={t} />
                ))}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
