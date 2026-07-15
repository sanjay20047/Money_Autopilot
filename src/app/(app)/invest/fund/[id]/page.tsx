import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { funds, mfTxns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getPortfolio, ASSET_CLASS_META } from "@/lib/mf";
import { fmt, fmtExact } from "@/lib/money";
import { Card, CardLabel, EmptyNote } from "@/components/ui";
import { addMfTxnAction, deleteMfTxnAction, deleteFundAction } from "@/app/actions-invest";

const field =
  "rounded-lg border border-hairline bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

export default async function FundPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;

  const db = await getDb();
  const [fund] = await db
    .select()
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.userId, user.id)))
    .limit(1);
  if (!fund) notFound();

  const [txns, portfolio] = await Promise.all([
    db
      .select()
      .from(mfTxns)
      .where(eq(mfTxns.fundId, fund.id))
      .orderBy(desc(mfTxns.occurredAt)),
    getPortfolio(user.id),
  ]);
  const holding = portfolio.holdings.find((h) => h.fund.id === fund.id);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight">{fund.name}</h1>
          <p className="text-[11px] text-ink-3">
            {ASSET_CLASS_META[fund.assetClass]?.label}
            {fund.schemeCode ? ` · scheme #${fund.schemeCode}` : " · manual (no NAV feed)"}
          </p>
        </div>
        <Link href="/invest" className="shrink-0 text-[12px] font-semibold text-brand">
          ← Invest
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat label="Current value" value={holding ? fmt(holding.valuePaise) : "—"} />
        <Stat label="Invested" value={holding ? fmt(Math.max(0, holding.investedPaise)) : "—"} />
        <Stat
          label="Units held"
          value={holding ? holding.units.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}
        />
        <Stat
          label="XIRR"
          value={holding?.xirrPct !== null && holding !== undefined ? `${holding.xirrPct}%` : "—"}
        />
      </div>

      {fund.currentNav && (
        <p className="px-1 text-[11px] text-ink-3">
          Latest NAV ₹{fund.currentNav.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
          {fund.navDate &&
            ` · ${new Date(fund.navDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        </p>
      )}

      <Card>
        <CardLabel>Add transaction</CardLabel>
        <form action={addMfTxnAction} className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
          <input type="hidden" name="fundId" value={fund.id} />
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Type
            <select name="type" className={field} defaultValue="buy">
              <option value="buy">Buy / SIP</option>
              <option value="sell">Sell / Redeem</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Amount (₹)
            <input className={field} type="number" name="amount" min="0.01" step="0.01" required />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Units
            <input className={field} type="number" name="units" min="0.0001" step="0.0001" required />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Date
            <input
              className={field}
              type="date"
              name="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </form>
      </Card>

      <Card>
        <CardLabel>Transactions</CardLabel>
        {txns.length === 0 ? (
          <EmptyNote>No transactions yet — add your SIP installments above.</EmptyNote>
        ) : (
          <div className="divide-y divide-hairline">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span
                  className={`w-10 shrink-0 text-[11px] font-bold uppercase ${
                    t.type === "buy" ? "text-brand" : "text-serious"
                  }`}
                >
                  {t.type}
                </span>
                <span className="min-w-0 flex-1 text-ink-2">
                  {new Date(t.occurredAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  <span className="text-ink-3">
                    {" "}
                    · {t.units.toLocaleString("en-IN", { maximumFractionDigits: 4 })} u @ ₹
                    {t.nav.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </span>
                <span className="tnum font-bold text-ink">{fmtExact(t.amountPaise)}</span>
                <form action={deleteMfTxnAction}>
                  <input type="hidden" name="txnId" value={t.id} />
                  <input type="hidden" name="fundId" value={fund.id} />
                  <button
                    type="submit"
                    aria-label="Delete transaction"
                    className="px-1 text-ink-3 hover:text-danger"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <form action={deleteFundAction} className="px-1">
        <input type="hidden" name="fundId" value={fund.id} />
        <button type="submit" className="text-[12px] font-semibold text-danger">
          Delete this fund and all its transactions
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
      <div className="tnum mt-0.5 truncate text-[15px] font-bold text-ink">{value}</div>
    </div>
  );
}
