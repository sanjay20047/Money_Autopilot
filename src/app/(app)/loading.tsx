// Route-level loading skeleton — paints instantly on every tab switch so
// navigation feels immediate while the server renders the real data.

export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-baseline justify-between px-1">
        <div className="h-6 w-32 rounded-lg bg-grid" />
        <div className="h-3 w-24 rounded bg-grid" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-2xl border border-hairline bg-card p-4">
          <div className="h-3 w-40 rounded bg-grid" />
          <div className="mt-4 h-8 w-28 rounded-lg bg-grid" />
          <div className="mt-6 h-14 rounded-lg bg-grid" />
        </div>
        <div className="h-48 rounded-2xl border border-hairline bg-card p-4">
          <div className="h-3 w-32 rounded bg-grid" />
          <div className="mt-4 flex items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-grid" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3 rounded bg-grid" />
              <div className="h-3 w-4/5 rounded bg-grid" />
              <div className="h-3 w-3/5 rounded bg-grid" />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-hairline bg-card p-4">
        <div className="h-3 w-36 rounded bg-grid" />
        <div className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-grid" />
              <div className="h-3.5 flex-1 rounded bg-grid" />
              <div className="h-3.5 w-16 rounded bg-grid" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
