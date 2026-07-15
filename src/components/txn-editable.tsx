// Editable transaction row (Spends page): tap a row to open the fix-it
// form — re-categorize (with "remember"), rename, adjust amount, or delete.

import { CATEGORY_LIST, categoryDef } from "@/lib/categories";
import { fmtExact } from "@/lib/money";
import type { Transaction } from "@/db/schema";
import { SourceBadge } from "@/components/ui";
import { updateTxnAction, deleteTxnAction } from "@/app/actions-txns";

const field =
  "rounded-lg border border-hairline bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

export function EditableTxnRow({ txn }: { txn: Transaction }) {
  const cat = categoryDef(txn.category);
  const isCredit = txn.type === "credit";
  const time = new Date(txn.occurredAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  const details = [cat.label, txn.account ? `··${txn.account}` : "", txn.channel, time]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: cat.color }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">
            {txn.merchant}
          </span>
          <span className="block truncate text-[11px] text-ink-3">{details}</span>
        </span>
        <SourceBadge source={txn.source} />
        <span
          className={`tnum shrink-0 text-[13.5px] font-bold ${isCredit ? "text-good" : "text-ink"}`}
        >
          {isCredit ? "+" : "−"}
          {fmtExact(txn.amountPaise)}
        </span>
        <span className="shrink-0 text-ink-3 transition-transform group-open:rotate-90">›</span>
      </summary>

      <div className="mb-2 rounded-xl bg-surface p-3">
        <form action={updateTxnAction} className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <input type="hidden" name="txnId" value={txn.id} />
          <label className="col-span-2 flex flex-col gap-1 text-[11px] font-semibold text-ink-2 md:col-span-1">
            Merchant
            <input className={field} type="text" name="merchant" defaultValue={txn.merchant} required />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Category
            <select className={field} name="category" defaultValue={txn.category}>
              {CATEGORY_LIST.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            Amount (₹)
            <input
              className={field}
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              defaultValue={(txn.amountPaise / 100).toFixed(txn.amountPaise % 100 === 0 ? 0 : 2)}
              required
            />
          </label>
          <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-4">
            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-2">
              <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[var(--brand)]" />
              Always use this category for “{txn.merchant}”
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white"
            >
              Save
            </button>
          </div>
        </form>
        <form action={deleteTxnAction} className="mt-2 border-t border-hairline pt-2">
          <input type="hidden" name="txnId" value={txn.id} />
          <button type="submit" className="text-[11.5px] font-semibold text-danger">
            Delete this transaction
          </button>
        </form>
      </div>
    </details>
  );
}
