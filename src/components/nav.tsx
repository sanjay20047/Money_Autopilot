"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/spends", label: "Spends", icon: ListIcon },
  { href: "/invest", label: "Invest", icon: TrendIcon },
  { href: "/goals", label: "Goals", icon: TargetIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
] as const;

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 9.5 10 3l7 6.5V17h-4.6v-4.4h-4.8V17H3V9.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function TrendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 15l4.5-5 3.5 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}
function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar — phones/small screens only. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-card/95 backdrop-blur pb-safe md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-brand" : "text-ink-3"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidebar — md and up. */
export function DesktopSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-hairline bg-card md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
          <rect width="64" height="64" rx="14" fill="var(--brand)" />
          <rect x="14" y="34" width="9" height="16" rx="3" fill="#fff" opacity="0.55" />
          <rect x="27.5" y="26" width="9" height="24" rx="3" fill="#fff" opacity="0.78" />
          <rect x="41" y="14" width="9" height="36" rx="3" fill="#fff" />
        </svg>
        <span className="text-[15px] font-bold tracking-tight text-ink">Money Autopilot</span>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                active
                  ? "bg-brand-soft text-brand-ink"
                  : "text-ink-2 hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-hairline px-5 py-4 text-xs text-ink-3">
        Signed in as <span className="font-semibold text-ink-2">{userName}</span>
      </div>
    </aside>
  );
}
