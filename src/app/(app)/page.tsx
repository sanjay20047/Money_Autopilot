import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getCurrentMonthStats,
  getPreviousMonthStats,
  getDailySpend,
  getRecentTransactions,
  hasAnyTransactions,
} from "@/lib/data";
import { fmt, fmtCompact } from "@/lib/money";
import { Card, CardLabel, StatTile, TxnRow, EmptyNote } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { loadDemoDataAction } from "@/app/actions";

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();

  const hasData = await hasAnyTransactions(user.id);
  if (!hasData) {
    return (
      <div className="flex flex-col gap-4">
        <header className="px-1">
          <h1 className="text-lg font-bold tracking-tight">
            {greeting(now)}, {user.name.split(" ")[0]}
          </h1>
        </header>
        <Card className="text-center">
          <h2 className="mt-2 text-lg font-bold">Let&apos;s get your money flowing in</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Connect your bank SMS via the webhook in{" "}
            <Link href="/settings" className="font-semibold text-brand">
              Settings
            </Link>{" "}
            — or load sample data to explore every screen first.
          </p>
          <form action={loadDemoDataAction} className="mt-5 pb-2">
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              Load demo data
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const [stats, prev, daily, recent] = await Promise.all([
    getCurrentMonthStats(user.id),
    getPreviousMonthStats(user.id),
    getDailySpend(user.id, 14),
    getRecentTransactions(user.id, 5),
  ]);

  const monthName = now.toLocaleDateString("en-IN", { month: "long" });
  const deltaPts =
    stats.savingsRatePct !== null && prev.savingsRatePct !== null
      ? stats.savingsRatePct - prev.savingsRatePct
      : null;

  // Autopilot: last month's surplus → sweep suggestion
  const prevSurplus = prev.inPaise - prev.spentPaise - prev.investedPaise;
  const sweep = Math.floor((prevSurplus * 0.75) / 50_000) * 50_000; // 75%, rounded to ₹500
  const todaySpend = daily[daily.length - 1] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-lg font-bold tracking-tight">
          {greeting(now)}, {user.name.split(" ")[0]}
        </h1>
        <span className="text-[11px] font-medium text-ink-3">
          {monthName} · day {now.getDate()}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardLabel>Savings rate — this month</CardLabel>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-3xl font-extrabold tracking-tight">
              {stats.savingsRatePct !== null ? `${stats.savingsRatePct}%` : "—"}
            </span>
            {deltaPts !== null && deltaPts !== 0 && (
              <span
                className={`text-xs font-bold ${deltaPts > 0 ? "text-good" : "text-serious"}`}
              >
                {deltaPts > 0 ? "▲" : "▼"} {Math.abs(deltaPts)} pts vs last month
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-2">
            {stats.inPaise > 0
              ? `${fmt(stats.inPaise - stats.spentPaise)} kept of ${fmt(stats.inPaise)} in`
              : "No income recorded yet this month"}
          </p>
          <Sparkline
            data={daily}
            className="mt-3"
            ariaLabel="Daily spend, last 14 days"
          />
          <div className="mt-1 flex justify-between text-[11px] text-ink-2">
            <span>Daily spend · last 14 days</span>
            <span className="tnum font-bold text-ink">{fmtCompact(todaySpend)} today</span>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="In" value={fmtCompact(stats.inPaise)} />
            <StatTile label="Spent" value={fmtCompact(stats.spentPaise)} />
            <StatTile label="Invested" value={fmtCompact(stats.investedPaise)} />
          </div>

          {sweep >= 100_000 && (
            <section className="rounded-2xl border border-brand-border bg-brand-soft p-4">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                Autopilot
              </div>
              <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-brand-ink">
                Last month closed with a{" "}
                <strong className="font-extrabold">{fmt(prevSurplus)} surplus</strong>. Consider
                sweeping <strong className="font-extrabold">{fmt(sweep)}</strong> into your index
                fund SIP.
              </p>
              <p className="mt-2 text-[11px] text-brand-ink/70">
                One-tap sweep actions arrive with the Invest module (M3).
              </p>
            </section>
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardLabel>Latest activity</CardLabel>
          <Link href="/spends" className="text-xs font-semibold text-brand">
            See all
          </Link>
        </div>
        <div className="divide-y divide-hairline">
          {recent.length === 0 ? (
            <EmptyNote>No transactions yet.</EmptyNote>
          ) : (
            recent.map((t) => <TxnRow key={t.id} txn={t} />)
          )}
        </div>
      </Card>
    </div>
  );
}
