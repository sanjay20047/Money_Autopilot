import Link from "next/link";
import { loginAction } from "@/app/actions";
import { AuthShell, AuthError, field, primaryBtn } from "../ui";

export const metadata = { title: "Log in" };

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;

  return (
    <AuthShell
      heading="Welcome back"
      sub="Log in to see where your money went."
    >
      <AuthError message={error} />
      <form action={loginAction} className="flex flex-col gap-3">
        <input
          className={field}
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          required
        />
        <input
          className={field}
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        <button className={primaryBtn} type="submit">
          Log in
        </button>
      </form>
      <p className="text-sm text-ink-2 text-center mt-5">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
