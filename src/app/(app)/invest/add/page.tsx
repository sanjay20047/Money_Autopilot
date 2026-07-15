import Link from "next/link";
import { Card } from "@/components/ui";
import { AddFundForm } from "@/components/add-fund-form";

export const metadata = { title: "Add fund" };

export default async function AddFundPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-bold tracking-tight">Add fund</h1>
        <Link href="/invest" className="text-[12px] font-semibold text-brand">
          ← Back to Invest
        </Link>
      </header>
      {error && (
        <p className="rounded-2xl bg-serious-soft px-4 py-3 text-sm font-medium text-serious">
          {error}
        </p>
      )}
      <Card>
        <AddFundForm />
      </Card>
    </div>
  );
}
