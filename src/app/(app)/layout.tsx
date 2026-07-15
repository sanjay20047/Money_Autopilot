import { requireUser } from "@/lib/auth";
import { DesktopSidebar, MobileTabBar } from "@/components/nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh bg-surface">
      <DesktopSidebar userName={user.name} />
      {/* content: full-width on phone, offset for sidebar on desktop */}
      <main className="mx-auto w-full max-w-lg px-4 pt-safe md:ml-60 md:max-w-4xl md:px-8 lg:mx-auto">
        {/* bottom padding clears the fixed tab bar on phones */}
        <div className="pb-28 pt-4 md:pb-12 md:pt-8">{children}</div>
      </main>
      <MobileTabBar />
    </div>
  );
}
