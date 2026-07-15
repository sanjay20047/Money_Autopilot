import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/money";
import { Card, CardLabel } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import {
  updateBudgetAction,
  regenerateTokenAction,
  clearDemoDataAction,
  logoutAction,
} from "@/app/actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { saved } = await props.searchParams;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ingestUrl = `${proto}://${host}/api/ingest`;

  const curl = [
    `curl -X POST ${ingestUrl} \\`,
    `  -H "Authorization: Bearer ${user.webhookToken}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"sender":"VM-HDFCBK","message":"Rs.412.00 debited from a/c **4821 on 14-07-26 to VPA swiggy@icici (UPI Ref No 519876543210)."}'`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1">
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
      </header>

      <Card>
        <CardLabel>SMS webhook — connect your iPhone</CardLabel>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          Bank SMS forwarded to this endpoint become transactions automatically.
          OTP messages are detected and dropped — they are never stored.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-[12px] text-ink">
            {ingestUrl}
          </code>
          <CopyButton text={ingestUrl} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-[12px] text-ink">
            {user.webhookToken}
          </code>
          <CopyButton text={user.webhookToken} label="Copy token" />
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-brand">
            iOS Shortcut setup (one time, ~10 min)
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
            <li>Open <strong>Shortcuts</strong> → Automation → <strong>New Automation</strong>.</li>
            <li>Choose <strong>Message</strong> → “Message Contains” → leave filter for your bank sender IDs (e.g. HDFCBK) → <strong>Run Immediately</strong>.</li>
            <li>Add action <strong>Get Contents of URL</strong>.</li>
            <li>URL: paste the endpoint above. Method: <strong>POST</strong>. Request Body: <strong>JSON</strong>.</li>
            <li>Add header <code>Authorization</code> = <code>Bearer &lt;your token&gt;</code>.</li>
            <li>JSON fields: <code>message</code> = Shortcut Input (the SMS text), <code>sender</code> = sender.</li>
            <li>Repeat the automation for each bank sender ID (HDFCBK, ICICIB, SBIINB…).</li>
          </ol>
        </details>

        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-brand">
            Test with curl
          </summary>
          <div className="relative mt-2">
            <pre className="overflow-x-auto rounded-lg bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink">
              {curl}
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton text={curl.replace(/ \\\n {2}/g, " ")} />
            </div>
          </div>
        </details>

        <form action={regenerateTokenAction} className="mt-4">
          <button
            type="submit"
            className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink"
          >
            Regenerate token
          </button>
          <span className="ml-2 text-[11px] text-ink-3">
            Invalidates the old token immediately.
          </span>
        </form>
      </Card>

      <Card>
        <CardLabel>Monthly budget</CardLabel>
        <form action={updateBudgetAction} className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
              ₹
            </span>
            <input
              type="text"
              name="budget"
              inputMode="numeric"
              defaultValue={Math.round(user.monthlyBudgetPaise / 100).toLocaleString("en-IN")}
              className="w-full rounded-xl border border-hairline bg-card py-2.5 pl-7 pr-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </form>
        <p className="mt-2 text-[11px] text-ink-3">
          Current: {fmt(user.monthlyBudgetPaise)} / month
          {saved && <span className="ml-2 font-semibold text-good">Saved ✓</span>}
        </p>
      </Card>

      <Card>
        <CardLabel>Account</CardLabel>
        <p className="mt-1 text-[13px] text-ink-2">
          {user.name} · {user.email}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/export"
            className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink"
          >
            ⬇ Export all transactions (CSV)
          </a>
          <form action={clearDemoDataAction}>
            <button
              type="submit"
              className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink"
            >
              Remove demo data
            </button>
          </form>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-semibold text-danger"
            >
              Log out
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
