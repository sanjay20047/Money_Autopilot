import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPortfolio, ASSET_CLASS_META } from "@/lib/mf";
import { fmt, fmtCompact } from "@/lib/money";
import { Card, CardLabel, Chip, EmptyNote } from "@/components/ui";
import { refreshNavAction, updateAllocationAction } from "@/app/actions-invest";

export const metadata = { title: "Invest" };

export default async function InvestPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await props.searchParams;
  const p = await getPortfolio(user.id);

  const gainPct =
    p.investedPaise > 0 ? Math.round((p.gainPaise / p.investedPaise) * 1000) / 10 : 0;

  // drift vs target (hybrid folds half into equity, half into debt)
  const pctOf = (cls: string) => p.allocation.find((a) => a.assetClass === cls)?.pct ?? 0;
  const equityNow = pctOf("equity") + Math.round(pctOf("hybrid") / 2);
  const drift = p.valuePaise > 0 ? equityNow - user.targetEquityPct : 0;

  const navUpdatedAt = p.holdings
    .map((h) => h.fund.navDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-bold tracking-tight">Invest</h1>
        <div className="flex items-center gap-2">
          <form action={refreshNavAction}>
            <button
              type="submit"
              className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink"
            >
              ↻ Refresh NAV
            </button>
          </form>
          <Link
            href="/invest/add"
            className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            + Add fund
          </Link>
        </div>
      </header>

      {error && (
        <p className="rounded-2xl bg-serious-soft px-4 py-3 text-sm font-medium text-serious">
          {error}
        </p>
      )}

      {p.holdings.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="text-lg font-bold">Track your mutual funds</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
            Add each fund you hold (search the official scheme list for live
            NAVs), enter your SIPs and lumpsums, and get true XIRR, daily
            valuation, and allocation-drift nudges.
          </p>
          <Link
            href="/invest/add"
            className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            Add your first fund
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardLabel>Portfolio value</CardLabel>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-3xl font-extrabold tracking-tight">
                  {fmt(p.valuePaise)}
                </span>
                {p.investedPaise > 0 && (
                  <span
                    className={`text-xs font-bold ${p.gainPaise >= 0 ? "text-good" : "text-serious"}`}
                  >
                    {p.gainPaise >= 0 ? "▲" : "▼"} {Math.abs(gainPct)}%
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-ink-2">
                Invested {fmt(p.investedPaise)} · gain{" "}
                <span className={`font-bold ${p.gainPaise >= 0 ? "text-good" : "text-serious"}`}>
                  {p.gainPaise >= 0 ? "+" : "−"}
                  {fmt(Math.abs(p.gainPaise))}
                </span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-[12px] font-bold text-brand-ink">
                  XIRR {p.xirrPct !== null ? `${p.xirrPct}%` : "—"}
                </span>
                {navUpdatedAt && (
                  <span className="text-[11px] text-ink-3">
                    NAV as of{" "}
                    {new Date(navUpdatedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
            </Card>

            <Card>
              <CardLabel>Allocation vs target</CardLabel>
              <div className="mt-2 flex h-3.5 gap-0.5 overflow-hidden rounded-md">
                {p.allocation.map((a) => (
                  <span
                    key={a.assetClass}
                    style={{
                      width: `${a.pct}%`,
                      background: ASSET_CLASS_META[a.assetClass]?.color ?? "#898781",
                    }}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {p.allocation.map((a) => {
                  const meta = ASSET_CLASS_META[a.assetClass];
                  const target =
                    a.assetClass === "equity"
                      ? user.targetEquityPct
                      : a.assetClass === "debt"
                        ? user.targetDebtPct
                        : a.assetClass === "gold"
                          ? user.targetGoldPct
                          : null;
                  return (
                    <li key={a.assetClass} className="flex items-center gap-2 text-[12px]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: meta?.color ?? "#898781" }}
                      />
                      <span className="flex-1 font-medium text-ink-2">
                        {meta?.label ?? a.assetClass}
                      </span>
                      <span className="tnum font-bold text-ink">
                        {a.pct}%
                        {target !== null && (
                          <span className="font-medium text-ink-3"> / {target}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {Math.abs(drift) >= 5 && (
                <div className="mt-3">
                  <Chip tone="warn">
                    ⚠ Equity drifted {drift > 0 ? "+" : "−"}
                    {Math.abs(drift)} pts — route the next SIP to{" "}
                    {drift > 0 ? "debt" : "equity"}?
                  </Chip>
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-semibold text-brand">
                  Edit target allocation
                </summary>
                <form
                  action={updateAllocationAction}
                  className="mt-2 flex items-end gap-2 text-[12px]"
                >
                  {(
                    [
                      ["equity", "Equity", user.targetEquityPct],
                      ["debt", "Debt", user.targetDebtPct],
                      ["gold", "Gold", user.targetGoldPct],
                    ] as const
                  ).map(([name, label, val]) => (
                    <label key={name} className="flex flex-col gap-1 font-medium text-ink-2">
                      {label} %
                      <input
                        type="number"
                        name={name}
                        defaultValue={val}
                        min={0}
                        max={100}
                        className="w-16 rounded-lg border border-hairline bg-card px-2 py-1.5 text-ink"
                      />
                    </label>
                  ))}
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-3 py-2 font-semibold text-white"
                  >
                    Save
                  </button>
                </form>
              </details>
            </Card>
          </div>

          <Card>
            <CardLabel>Holdings</CardLabel>
            {p.holdings.length === 0 ? (
              <EmptyNote>No funds yet.</EmptyNote>
            ) : (
              <div className="divide-y divide-hairline">
                {p.holdings.map((h) => (
                  <Link
                    key={h.fund.id}
                    href={`/invest/fund/${h.fund.id}`}
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: ASSET_CLASS_META[h.fund.assetClass]?.color ?? "#898781",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {h.fund.name}
                      </span>
                      <span className="block text-[11px] text-ink-3">
                        {ASSET_CLASS_META[h.fund.assetClass]?.label} ·{" "}
                        {h.units.toLocaleString("en-IN", { maximumFractionDigits: 3 })} units
                        {!h.navKnown && " · NAV pending"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tnum block text-[13.5px] font-bold text-ink">
                        {fmtCompact(h.valuePaise)}
                      </span>
                      <span
                        className={`block text-[11px] font-semibold ${
                          h.xirrPct === null
                            ? "text-ink-3"
                            : h.xirrPct >= 0
                              ? "text-good"
                              : "text-serious"
                        }`}
                      >
                        {h.xirrPct !== null ? `XIRR ${h.xirrPct}%` : "XIRR —"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
