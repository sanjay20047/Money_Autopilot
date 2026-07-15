import { categoryDef } from "@/lib/categories";
import { fmtExact } from "@/lib/money";
import type { Transaction } from "@/db/schema";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-hairline bg-card p-4 ${className}`}>
      {children}
    </section>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">
      {children}
    </h3>
  );
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
      <div className="tnum mt-0.5 truncate text-[15px] font-bold text-ink">{value}</div>
    </div>
  );
}

export function Chip({
  tone,
  children,
}: {
  tone: "good" | "warn" | "serious" | "brand";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    serious: "bg-serious-soft text-serious",
    brand: "bg-brand-soft text-brand-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded-md border border-hairline px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-3">
      {source}
    </span>
  );
}

export function TxnRow({ txn }: { txn: Transaction }) {
  const cat = categoryDef(txn.category);
  const isCredit = txn.type === "credit";
  const time = new Date(txn.occurredAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  const details = [
    cat.label,
    txn.account ? `··${txn.account}` : "",
    txn.channel,
    time,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: cat.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{txn.merchant}</div>
        <div className="truncate text-[11px] text-ink-3">{details}</div>
      </div>
      <SourceBadge source={txn.source} />
      <div
        className={`tnum shrink-0 text-[13.5px] font-bold ${isCredit ? "text-good" : "text-ink"}`}
      >
        {isCredit ? "+" : "−"}
        {fmtExact(txn.amountPaise)}
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-3">{children}</p>;
}
