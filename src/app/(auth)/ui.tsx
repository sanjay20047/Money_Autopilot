// Shared bits for the login / signup screens.

export const field =
  "w-full rounded-xl border border-hairline bg-card px-4 py-3 text-base text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export const primaryBtn =
  "w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white active:opacity-90 hover:opacity-95";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--brand)" />
        <rect x="14" y="34" width="9" height="16" rx="3" fill="#fff" opacity="0.55" />
        <rect x="27.5" y="26" width="9" height="24" rx="3" fill="#fff" opacity="0.78" />
        <rect x="41" y="14" width="9" height="36" rx="3" fill="#fff" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-ink">
        Money Autopilot
      </span>
    </span>
  );
}

export function AuthError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl bg-serious-soft px-4 py-3 text-sm font-medium text-serious"
    >
      {message}
    </p>
  );
}

export function AuthShell({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-ink">{heading}</h1>
          <p className="mb-5 mt-1 text-sm text-ink-2">{sub}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-ink-3">
          Self-hosted · your data never leaves your server
        </p>
      </div>
    </main>
  );
}
