"use client";

import { useEffect, useRef, useState } from "react";
import { addFundAction } from "@/app/actions-invest";

interface SchemeResult {
  schemeCode: number;
  schemeName: string;
}

const field =
  "w-full rounded-xl border border-hairline bg-card px-3.5 py-2.5 text-base text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export function AddFundForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchemeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [picked, setPicked] = useState<SchemeResult | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (picked || query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/mf/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "search failed");
        setResults(json.results ?? []);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search unavailable");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, picked]);

  return (
    <form action={addFundAction} className="flex flex-col gap-4">
      {/* scheme search */}
      <div>
        <label className="mb-1 block text-[12px] font-semibold text-ink-2">
          Fund name{" "}
          <span className="font-normal text-ink-3">
            (search the official scheme list for live NAV)
          </span>
        </label>
        <input
          className={field}
          type="text"
          name="name"
          placeholder="e.g. Parag Parikh Flexi Cap Direct Growth"
          value={picked ? picked.schemeName : query}
          onChange={(e) => {
            setPicked(null);
            setQuery(e.target.value);
          }}
          autoComplete="off"
          required
        />
        <input type="hidden" name="schemeCode" value={picked ? String(picked.schemeCode) : ""} />

        {searching && <p className="mt-1.5 text-[12px] text-ink-3">Searching…</p>}
        {searchError && (
          <p className="mt-1.5 text-[12px] font-medium text-warn">
            {searchError} — you can still add it manually; NAV stays blank.
          </p>
        )}
        {results.length > 0 && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-hairline bg-card">
            {results.map((r) => (
              <li key={r.schemeCode}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(r);
                    setResults([]);
                  }}
                  className="w-full border-b border-hairline px-3.5 py-2.5 text-left text-[13px] text-ink last:border-b-0 hover:bg-brand-soft"
                >
                  {r.schemeName}
                  <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                    #{r.schemeCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <p className="mt-1.5 text-[12px] font-medium text-good">
            ✓ Linked to scheme #{picked.schemeCode} — NAV will sync automatically
          </p>
        )}
      </div>

      {/* asset class */}
      <div>
        <label className="mb-1 block text-[12px] font-semibold text-ink-2">Asset class</label>
        <select name="assetClass" className={field} defaultValue="equity" required>
          <option value="equity">Equity</option>
          <option value="debt">Debt</option>
          <option value="gold">Gold</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      {/* optional opening position */}
      <fieldset className="rounded-xl border border-hairline p-3.5">
        <legend className="px-1 text-[12px] font-semibold text-ink-2">
          Opening position <span className="font-normal text-ink-3">(optional — add more later)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
            Amount invested (₹)
            <input className={field} type="number" name="amount" min="0" step="0.01" placeholder="50000" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
            Units allotted
            <input className={field} type="number" name="units" min="0" step="0.0001" placeholder="117.35" />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-[12px] font-medium text-ink-2">
          Date
          <input
            className={field}
            type="date"
            name="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
          Tip: your units and amounts are in the AMC allotment SMS/email and on
          your platform (Groww/Coin/etc). For a running SIP, add each installment
          from the fund&apos;s page — XIRR needs the real dates.
        </p>
      </fieldset>

      <button
        type="submit"
        className="rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white"
      >
        Add fund
      </button>
    </form>
  );
}
