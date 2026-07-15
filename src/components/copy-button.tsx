"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard unavailable (non-https context) — select-and-copy manually
        }
      }}
      className="shrink-0 rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 hover:text-ink"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
