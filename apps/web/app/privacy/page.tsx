import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How NodeTasks handles your data on the website and in the desktop app.",
  alternates: { canonical: "https://nodetasks.com/privacy" },
};

const LAST_UPDATED = "April 19, 2026";
const GITHUB_REPO = "hostingcs/nodetasks";

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header>
        <div className="mx-auto max-w-5xl w-full px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold tracking-tight">NodeTasks</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-[color:var(--muted)]">
            <Link
              href="/download"
              className="hover:text-[color:var(--foreground)] transition-colors"
            >
              Download
            </Link>
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              className="hover:text-[color:var(--foreground)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-14 sm:py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)] font-medium mb-4">
          Last updated {LAST_UPDATED}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--muted)]">
          NodeTasks is an open-source Windows desktop app. This policy covers
          the small amount of data the website and app handle.
        </p>

        <article className="mt-10 space-y-10 text-[14.5px] leading-relaxed">
          <Section title="Desktop app">
            <p>
              The NodeTasks desktop app runs entirely on your machine and does
              not send telemetry, usage statistics, crash reports, or any
              personal information to any server.
            </p>
            <p>
              It reads process information locally via Windows APIs (the list
              of running <code className="font-mono">node.exe</code> processes,
              their CPU time, memory usage, and command line). This data never
              leaves your computer.
            </p>
            <p>
              When the app starts, it performs one network request: fetching{" "}
              <code className="font-mono">
                raw.githubusercontent.com/{GITHUB_REPO}/main/manifest.json
              </code>{" "}
              to check whether a new version is available. If so, it downloads
              the corresponding{" "}
              <code className="font-mono">resources.neu</code> file from
              GitHub Releases. These requests are unauthenticated and reveal
              only your IP address to GitHub, in line with GitHub&apos;s own
              privacy policy.
            </p>
            <p>
              If you enable{" "}
              <span className="text-[color:var(--foreground)]">
                Start with Windows
              </span>{" "}
              in settings, the app writes a single value to the Windows user
              registry (
              <code className="font-mono">
                HKCU\Software\Microsoft\Windows\CurrentVersion\Run
              </code>
              ) so the app launches at login. Toggling it off removes the
              value.
            </p>
          </Section>

          <Section title="Website analytics">
            <p>
              The nodetasks.com website uses a first-party pixel to count page
              views. For each view we record: the visited path, the referrer
              URL (if any), your browser&apos;s user-agent string, the country
              derived from your IP, and a hash of your IP address rotated
              daily with a private salt. We do{" "}
              <span className="text-[color:var(--foreground)]">not</span>{" "}
              store raw IP addresses, place tracking cookies, or share this
              data with third-party analytics providers.
            </p>
            <p>
              The daily-hashed IP lets us count rough unique visitors over a
              24-hour window without being able to identify individual people.
            </p>
          </Section>

          <Section title="Admin cookies">
            <p>
              The site has a small admin dashboard protected by a login. Only
              the site operator uses it. After sign-in, we set an{" "}
              <code className="font-mono">httpOnly</code>, same-site signed
              cookie named{" "}
              <code className="font-mono">nt_admin</code> that identifies the
              authenticated session for up to 30 days. No cookies are set for
              anonymous visitors.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>Running NodeTasks and the website involves these providers:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-[color:var(--muted)]">
              <li>
                <span className="text-[color:var(--foreground)]">GitHub</span>{" "}
                hosts the source code, releases, and the update manifest.
              </li>
              <li>
                <span className="text-[color:var(--foreground)]">
                  SignPath Foundation
                </span>{" "}
                code-signs Windows binaries.
              </li>
              <li>
                <span className="text-[color:var(--foreground)]">Railway</span>{" "}
                hosts the website and Postgres database that stores the
                analytics events described above.
              </li>
              <li>
                <span className="text-[color:var(--foreground)]">
                  Cloudflare
                </span>{" "}
                sits in front of nodetasks.com as a DNS/CDN layer.
              </li>
            </ul>
            <p>
              Each provider has its own privacy policy; your interaction with
              them (for example, requesting a page from nodetasks.com or
              downloading a release from GitHub) is subject to those policies
              in addition to this one.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              Analytics events are retained indefinitely in aggregate form
              inside our Postgres database. Because IPs are hashed daily with
              a rotating salt, older rows lose the ability to be linked back
              to a specific device after the salt rotates.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              We do not collect any information that identifies you
              personally. If you believe we have inadvertently collected data
              about you and want it removed, open an issue at{" "}
              <a
                href={`https://github.com/${GITHUB_REPO}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--foreground)] underline decoration-[color:var(--accent)]/60 underline-offset-2 hover:decoration-[color:var(--accent)]"
              >
                github.com/{GITHUB_REPO}/issues
              </a>
              .
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If this policy changes, the &quot;Last updated&quot; date at the
              top of the page will reflect the new date. Material changes
              will be summarized in the project&apos;s release notes.
            </p>
          </Section>
        </article>
      </main>

      <footer className="mt-12">
        <div className="mx-auto max-w-5xl w-full px-6 py-6 flex items-center justify-between text-xs text-[color:var(--muted)]">
          <div className="flex items-center gap-4">
            <Link
              href="/download"
              className="hover:text-[color:var(--foreground)] transition"
            >
              Download
            </Link>
            <Link
              href="/privacy"
              className="hover:text-[color:var(--foreground)] transition"
            >
              Privacy
            </Link>
            <a
              className="hover:text-[color:var(--foreground)] transition"
              href={`https://github.com/${GITHUB_REPO}/blob/main/LICENSE`}
            >
              MIT
            </a>
          </div>
          <span>Code signing by SignPath Foundation</span>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function LogoMark() {
  return (
    <span className="inline-block w-5 h-5 rounded-[5px] bg-[color:var(--accent)] grid place-items-center text-[11px] font-bold text-[#04121f]">
      N
    </span>
  );
}
