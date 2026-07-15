import { requireUser } from "@/lib/auth";
import { getGoalsOverview, computeSalarySplit } from "@/lib/goals";
import { getCurrentMonthStats } from "@/lib/data";
import { fmt } from "@/lib/money";
import { Card, CardLabel, Chip } from "@/components/ui";
import { Meter } from "@/components/charts";
import {
  addGoalAction,
  addContributionAction,
  deleteGoalAction,
  applySalarySplitAction,
} from "@/app/actions-goals";

export const metadata = { title: "Goals" };

const field =
  "rounded-lg border border-hairline bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

function monthYear(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default async function GoalsPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await props.searchParams;

  const [overview, stats] = await Promise.all([
    getGoalsOverview(user.id),
    getCurrentMonthStats(user.id),
  ]);
  const split = computeSalarySplit(overview, stats.inPaise);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-lg font-bold tracking-tight">Goals</h1>
        <span className="text-[11px] font-medium text-ink-3">
          {overview.length} active
        </span>
      </header>

      {error && (
        <p className="rounded-2xl bg-serious-soft px-4 py-3 text-sm font-medium text-serious">
          {error}
        </p>
      )}

      {/* salary-day coach card */}
      {split && (
        <section className="rounded-2xl border border-brand-border bg-brand-soft p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
            This month&apos;s plan
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-brand-ink">
            <strong className="font-extrabold">{fmt(stats.inPaise)}</strong> came in this
            month. Set aside <strong className="font-extrabold">{fmt(split.totalPaise)}</strong>{" "}
            to keep every goal on track:
          </p>
          <ul className="mt-2.5 flex flex-col gap-1">
            {split.perGoal.map((g) => (
              <li key={g.goalId} className="flex justify-between text-[12.5px] text-brand-ink">
                <span className="font-medium">{g.name}</span>
                <span className="tnum font-extrabold">{fmt(g.amountPaise)}</span>
              </li>
            ))}
          </ul>
          <form action={applySalarySplitAction} className="mt-3">
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Mark {fmt(split.totalPaise)} saved
            </button>
          </form>
          <p className="mt-2 text-[11px] text-brand-ink/70">
            This records the contribution here — move the actual money in your bank/fund app.
          </p>
        </section>
      )}

      {/* goal list */}
      <Card>
        <CardLabel>Your goals</CardLabel>
        {overview.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">
            No goals yet — create your first one below. Try “Emergency fund”.
          </p>
        ) : (
          <div className="divide-y divide-hairline">
            {overview.map((g) => (
              <div key={g.goal.id} className="py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-ink">{g.goal.name}</span>
                  {g.status === "done" ? (
                    <Chip tone="good">✓ Done</Chip>
                  ) : g.status === "on-track" ? (
                    <Chip tone="good">✓ On track</Chip>
                  ) : (
                    <Chip tone="serious">! Behind</Chip>
                  )}
                </div>
                <Meter pct={g.pct} className="mt-2.5" />
                <div className="mt-1.5 flex justify-between text-[11px] text-ink-2">
                  <span>
                    <b className="tnum text-ink">{fmt(g.savedPaise)}</b> of{" "}
                    {fmt(g.goal.targetPaise)}
                  </span>
                  <span>
                    {monthYear(g.goal.targetDate)}
                    {g.status !== "done" && ` · needs ${fmt(g.neededPerMonthPaise)}/mo`}
                  </span>
                </div>

                {g.status === "behind" && (
                  <p className="mt-2 rounded-lg bg-serious-soft px-3 py-2 text-[12px] leading-relaxed text-serious">
                    Coach: add <b>{fmt(g.extraPerMonthPaise)}/mo</b> extra to catch up
                    {g.pushedDate &&
                      `, or push the date to ${monthYear(g.pushedDate)} and keep your current pace`}
                    . Your call.
                  </p>
                )}

                <div className="mt-2 flex items-center gap-3">
                  <details>
                    <summary className="cursor-pointer text-[12px] font-semibold text-brand">
                      Add money
                    </summary>
                    <form action={addContributionAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="goalId" value={g.goal.id} />
                      <input
                        className={`${field} w-32`}
                        type="number"
                        name="amount"
                        min="1"
                        step="1"
                        placeholder="₹ amount"
                        required
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white"
                      >
                        Save
                      </button>
                    </form>
                  </details>
                  <form action={deleteGoalAction}>
                    <input type="hidden" name="goalId" value={g.goal.id} />
                    <button type="submit" className="text-[12px] font-medium text-ink-3 hover:text-danger">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* new goal */}
      <Card>
        <CardLabel>New goal</CardLabel>
        <form action={addGoalAction} className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1 text-[11px] font-semibold text-ink-2 md:col-span-1">
            Name
            <input className={field} type="text" name="name" placeholder="Goa trip" required />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Target (₹)
            <input className={field} type="number" name="target" min="1" placeholder="40000" required />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            By when
            <input className={field} type="date" name="targetDate" required />
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            Create goal
          </button>
        </form>
      </Card>
    </div>
  );
}
