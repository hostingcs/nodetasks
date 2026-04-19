import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser().catch(() => null);
  if (user) redirect("/admin");

  const { error } = await searchParams;
  const errorMessage =
    error === "invalid"
      ? "Invalid username or password."
      : error === "missing"
      ? "Enter a username and password."
      : null;

  return (
    <div className="flex-1 grid place-items-center px-6 py-10">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 space-y-5"
      >
        <div>
          <h1 className="text-lg font-semibold">Admin sign in</h1>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Restricted area.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="block text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Username
          </span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            required
            className="w-full rounded-md bg-[#131317] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Password
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md bg-[#131317] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>

        {errorMessage ? (
          <div className="text-xs text-[color:var(--danger)]">{errorMessage}</div>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--accent)] text-[#04121f] font-semibold text-sm py-2 hover:brightness-110 transition"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
