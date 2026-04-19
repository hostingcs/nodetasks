import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Download",
  description:
    "Download NodeTasks for Windows — installer or portable ZIP. Free, open source, code-signed by SignPath Foundation.",
  alternates: { canonical: "https://nodetasks.com/download" },
};

const GITHUB_REPO = "hostingcs/nodetasks";

type Release = {
  tag_name?: string;
  published_at?: string;
  html_url?: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    updated_at?: string;
  }>;
};

async function getLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        next: { revalidate: 60 },
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as Release;
  } catch {
    return null;
  }
}

function formatBytes(n?: number) {
  if (!n) return null;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DownloadPage() {
  const release = await getLatestRelease();
  const installer = release?.assets?.find((a) =>
    a.name.toLowerCase().endsWith("-setup.exe")
  );
  const portable = release?.assets?.find((a) =>
    a.name.toLowerCase().endsWith("-portable.zip")
  );
  const version = release?.tag_name?.replace(/^v/, "") ?? null;
  const published = formatDate(release?.published_at);

  return (
    <div className="flex-1 flex flex-col">
      <header>
        <div className="mx-auto max-w-5xl w-full px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold tracking-tight">NodeTasks</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-[color:var(--muted)]">
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              className="hover:text-[color:var(--foreground)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href={`https://github.com/${GITHUB_REPO}/releases`}
              className="hover:text-[color:var(--foreground)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Releases
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-14 sm:py-20 space-y-14">
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)] font-medium mb-4">
            Download · Windows 10/11 · 64-bit
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Get NodeTasks
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted)] max-w-xl">
            Free and open source. Two download options below — the installer
            is recommended for most users.
          </p>
          {version ? (
            <p className="mt-3 text-xs font-mono text-[color:var(--muted)]">
              v{version}
              {published ? ` · released ${published}` : ""}
            </p>
          ) : null}
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <DownloadCard
            title="Installer"
            subtitle="Recommended"
            description="One-click Windows installer. Adds Start Menu and Desktop shortcuts, registers an uninstaller, and enables auto-updates."
            href={
              installer?.browser_download_url ??
              `https://github.com/${GITHUB_REPO}/releases/latest`
            }
            filename={installer?.name ?? "NodeTasks-Setup.exe"}
            size={formatBytes(installer?.size)}
            primary
          />
          <DownloadCard
            title="Portable"
            subtitle="No install"
            description="ZIP containing NodeTasks.exe and resources.neu. Extract anywhere and run — no installer, no registry entries."
            href={
              portable?.browser_download_url ??
              `https://github.com/${GITHUB_REPO}/releases/latest`
            }
            filename={portable?.name ?? "NodeTasks-portable.zip"}
            size={formatBytes(portable?.size)}
          />
        </section>

        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Code signing
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)] leading-relaxed">
            NodeTasks Windows binaries are code-signed through{" "}
            <a
              href="https://signpath.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--foreground)] underline decoration-[color:var(--accent)]/60 underline-offset-2 hover:decoration-[color:var(--accent)]"
            >
              SignPath.io
            </a>
            . The code-signing certificate is issued by the{" "}
            <a
              href="https://signpath.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--foreground)] underline decoration-[color:var(--accent)]/60 underline-offset-2 hover:decoration-[color:var(--accent)]"
            >
              SignPath Foundation
            </a>
            , a non-profit organization that provides free code signing to
            open source projects.
          </p>
          <p className="mt-3 text-sm text-[color:var(--muted)] leading-relaxed">
            You can verify the signature on any released NodeTasks binary by
            right-clicking the file in Windows Explorer, opening{" "}
            <span className="text-[color:var(--foreground)]">Properties</span>,
            and checking the <span className="text-[color:var(--foreground)]">Digital Signatures</span>{" "}
            tab.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            System requirements
          </h2>
          <ul className="mt-3 text-sm text-[color:var(--muted)] space-y-1.5">
            <li>Windows 10 or Windows 11, 64-bit</li>
            <li>
              WebView2 runtime (installed by default on Windows 11; on older
              Windows 10 builds it&apos;s installed automatically by Windows
              Update)
            </li>
            <li>~3 MB disk space</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Something wrong?
          </h2>
          <ul className="mt-3 text-sm text-[color:var(--muted)] space-y-1.5">
            <li>
              <a
                href={`https://github.com/${GITHUB_REPO}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[color:var(--foreground)]"
              >
                Browse all releases on GitHub →
              </a>
            </li>
            <li>
              <a
                href={`https://github.com/${GITHUB_REPO}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[color:var(--foreground)]"
              >
                Report a bug or request a feature →
              </a>
            </li>
          </ul>
        </section>
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

function DownloadCard({
  title,
  subtitle,
  description,
  href,
  filename,
  size,
  primary,
}: {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  filename: string;
  size: string | null;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 sm:p-6 hover:border-[color:var(--accent)]/60 transition-colors block"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
            primary
              ? "bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
              : "bg-[color:var(--border)] text-[color:var(--muted)]"
          }`}
        >
          {subtitle}
        </span>
      </div>
      <p className="mt-2 text-sm text-[color:var(--muted)] leading-relaxed">
        {description}
      </p>
      <div className="mt-5 flex items-center justify-between text-xs font-mono">
        <span className="text-[color:var(--muted)] truncate">{filename}</span>
        <span className="text-[color:var(--muted)] tabular-nums flex-shrink-0">
          {size ?? "—"}
        </span>
      </div>
      <div
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${
          primary
            ? "text-[color:var(--accent)]"
            : "text-[color:var(--foreground)]"
        }`}
      >
        <DownloadIcon />
        <span>Download</span>
      </div>
    </a>
  );
}

function LogoMark() {
  return (
    <span className="inline-block w-5 h-5 rounded-[5px] bg-[color:var(--accent)] grid place-items-center text-[11px] font-bold text-[#04121f]">
      N
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
