import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "./actions";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser().catch(() => null);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-6xl w-full px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="inline-block w-5 h-5 rounded-[5px] bg-[color:var(--accent)] grid place-items-center text-[11px] font-bold text-[#04121f]">
              N
            </span>
            <span className="font-semibold tracking-tight">
              NodeTasks <span className="text-[color:var(--muted)]">· Admin</span>
            </span>
          </Link>
          {user ? (
            <form action={logoutAction} className="flex items-center gap-3">
              <span className="text-xs text-[color:var(--muted)]">
                Signed in as <span className="text-[color:var(--foreground)]">{user}</span>
              </span>
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-md border border-[color:var(--border)] hover:bg-[color:var(--surface)] transition"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-10">
        {children}
      </main>
    </div>
  );
}
