// Hand-rolled SVG charts — server-renderable, no client JS.

export function Sparkline({
  data,
  height = 56,
  className = "",
  ariaLabel,
}: {
  data: number[];
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  const W = 280;
  const H = height;
  const pad = 6;
  const baseline = H - 6;

  if (data.length < 2 || data.every((v) => v === 0)) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full ${className}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <line x1="0" y1={baseline} x2={W} y2={baseline} stroke="var(--grid)" strokeWidth="1" />
      </svg>
    );
  }

  const max = Math.max(...data);
  const stepX = (W - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = baseline - (max === 0 ? 0 : (v / max) * (baseline - pad));
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)} ${baseline} L${pts[0][0].toFixed(1)} ${baseline} Z`;
  const [ex, ey] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <line x1="0" y1={baseline} x2={W} y2={baseline} stroke="var(--grid)" strokeWidth="1" />
      <path d={area} fill="var(--brand)" opacity="0.10" />
      <path
        d={path}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={ex} cy={ey} r="3.5" fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}

export interface DonutSlice {
  value: number;
  color: string;
}

export function Donut({
  slices,
  centerTitle,
  centerSub,
  size = 108,
  ariaLabel,
}: {
  slices: DonutSlice[];
  centerTitle: string;
  centerSub?: string;
  size?: number;
  ariaLabel: string;
}) {
  const R = 40;
  const C = 2 * Math.PI * R; // ≈ 251.33
  const total = slices.reduce((s, x) => s + x.value, 0);
  const GAP = slices.length > 1 ? 3 : 0;

  let offset = 0;
  const segs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const len = (s.value / total) * C;
      const seg = { len: Math.max(len - GAP, 0.5), color: s.color, offset, key: i };
      offset += len;
      return seg;
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 104 104"
      role="img"
      aria-label={ariaLabel}
      className="shrink-0"
    >
      <g transform="rotate(-90 52 52)">
        {total === 0 ? (
          <circle cx="52" cy="52" r={R} fill="none" stroke="var(--grid)" strokeWidth="13" />
        ) : (
          segs.map((s) => (
            <circle
              key={s.key}
              cx="52"
              cy="52"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="13"
              strokeDasharray={`${s.len.toFixed(2)} ${C.toFixed(2)}`}
              strokeDashoffset={(-s.offset).toFixed(2)}
            />
          ))
        )}
      </g>
      <text
        x="52"
        y="49"
        textAnchor="middle"
        fontSize="15"
        fontWeight="750"
        fill="var(--ink)"
      >
        {centerTitle}
      </text>
      {centerSub ? (
        <text x="52" y="63" textAnchor="middle" fontSize="8.5" fill="var(--ink-3)">
          {centerSub}
        </text>
      ) : null}
    </svg>
  );
}

export function Meter({
  pct,
  className = "",
}: {
  pct: number; // 0–100
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-grid ${className}`}>
      <div
        className="h-full rounded-full bg-brand"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
