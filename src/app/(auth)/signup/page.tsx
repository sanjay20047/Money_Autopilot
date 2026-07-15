import Link from "next/link";
import { signupAction } from "@/app/actions";
import { AuthShell, AuthError, field, primaryBtn } from "../ui";

export const metadata = { title: "Sign up" };

export default async function SignupPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;

  return (
    <AuthShell
      heading="Create your account"
      sub="Your data stays in your own database — private by design."
    >
      <AuthError message={error} />
      <form action={signupAction} className="flex flex-col gap-3">
        <input
          className={field}
          type="text"
          name="name"
          placeholder="Your name"
          autoComplete="name"
          required
        />
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
          placeholder="Password (8+ characters)"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {process.env.INVITE_CODE && (
          <input
            className={field}
            type="text"
            name="invite"
            placeholder="Invite code"
            autoComplete="off"
            required
          />
        )}
        <button className={primaryBtn} type="submit">
          Create account
        </button>
      </form>
      <p className="text-sm text-ink-2 text-center mt-5">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
