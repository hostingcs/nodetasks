import Link from "next/link";

export const revalidate = 60;

const GITHUB_REPO = "hostingcs/nodetasks";

type Release = {
  tag_name?: string;
  name?: string;
  published_at?: string;
  html_url?: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
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

async function getTotalDownloads(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`,
      {
        next: { revalidate: 60 },
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (!res.ok) return null;
    const releases = (await res.json()) as Array<{
      assets?: Array<{ name: string; download_count: number }>;
    }>;
    let total = 0;
    for (const r of releases) {
      for (const a of r.assets ?? []) {
        const n = a.name.toLowerCase();
        if (n.endsWith("-setup.exe") || n.endsWith("-portable.zip")) {
          total += a.download_count;
        }
      }
    }
    return total;
  } catch {
    return null;
  }
}

function formatBytes(n?: number) {
  if (!n) return null;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export default async function Home() {
  const [release, totalDownloads] = await Promise.all([
    getLatestRelease(),
    getTotalDownloads(),
  ]);
  const exe = release?.assets?.find((a) => a.name.endsWith(".exe"));
  const version = release?.tag_name?.replace(/^v/, "") ?? null;
  const size = formatBytes(exe?.size);
  const hasRelease = !!exe;

  return (
    <div className="flex-1 flex flex-col">
      <header>
        <div className="mx-auto max-w-5xl w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold tracking-tight">NodeTasks</span>
          </div>
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

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
        <section className="grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-20 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)] font-medium mb-5">
              Windows · Native · ~2 MB
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
              Monitor every Node.js process on your machine.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-[color:var(--muted)] max-w-lg">
              A tiny native Windows app that shows live CPU and memory for every{" "}
              <code className="font-mono text-[13px] text-[color:var(--foreground)]">
                node.exe
              </code>{" "}
              — and kills them all with one click.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={hasRelease ? "/api/download" : `https://github.com/${GITHUB_REPO}/releases/latest`}
                className="inline-flex items-center gap-2 rounded-md bg-[color:var(--accent)] text-[#04121f] px-5 py-2.5 text-sm font-semibold hover:brightness-110 transition"
              >
                <DownloadIcon />
                Download for Windows
              </a>
              <a
                href={`https://github.com/${GITHUB_REPO}`}
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface)] transition"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon />
                View source
              </a>
            </div>

            <p className="mt-4 text-xs text-[color:var(--muted)] font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{version ? `v${version}` : "No release yet"}</span>
              {size ? <span aria-hidden>·</span> : null}
              {size ? <span>{size}</span> : null}
              <span aria-hidden>·</span>
              <span>Windows 10/11</span>
              {totalDownloads !== null && totalDownloads > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-[color:var(--foreground)]">
                    <span className="tabular-nums">
                      {formatCount(totalDownloads)}
                    </span>{" "}
                    <span className="text-[color:var(--muted)]">downloads</span>
                  </span>
                </>
              ) : null}
            </p>

            <p className="mt-3 text-xs">
              <Link
                href="/download"
                className="text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition"
              >
                See all download options →
              </Link>
            </p>
          </div>

          <AppPreview />
        </section>

        <section className="mt-24 grid sm:grid-cols-3 gap-4">
          <Feature
            title="Live usage"
            body="CPU percentage and resident memory for every node.exe, sampled every 1.5s."
          />
          <Feature
            title="Combined totals"
            body="Aggregate CPU and RAM across all Node processes, updated in real time."
          />
          <Feature
            title="Kill All, instantly"
            body="One button terminates every running Node process. No confirmation, no fluff."
          />
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-[color:var(--muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-[color:var(--accent)] opacity-[0.07] blur-3xl rounded-[50%]" />
      <div className="relative rounded-xl border border-[color:var(--border)] bg-[#1b1b1e] shadow-2xl shadow-black/40 overflow-hidden">
        <div className="h-7 border-b border-[color:var(--border)] bg-[#18181b] flex items-center gap-1.5 px-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a40]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a40]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a40]" />
          <span className="ml-3 text-[11px] text-[color:var(--muted)]">
            NodeTasks
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-baseline gap-2">
            <h4 className="text-[13px] font-semibold">NodeTasks</h4>
            <span className="text-[10px] text-[color:var(--muted)]">
              Node.js process monitor
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Processes" value="4" />
            <Stat label="Total CPU" value="12.8%" />
            <Stat label="Total RAM" value="412 MB" />
          </div>
          <div className="rounded-md border border-[color:var(--border)] bg-[#25252a] overflow-hidden">
            <div className="grid grid-cols-[50px_52px_72px_1fr] gap-2 px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-[color:var(--muted)] bg-[#2c2c32] border-b border-[color:var(--border)] font-mono">
              <div>PID</div>
              <div>CPU</div>
              <div>Mem</div>
              <div>Command</div>
            </div>
            {[
              ["12480", "6.4%", "182 MB", "next dev"],
              ["3914", "3.1%", "98 MB", "vite"],
              ["8821", "2.0%", "74 MB", "jest --watch"],
              ["20188", "1.3%", "58 MB", "server.js"],
            ].map(([pid, cpu, mem, cmd]) => (
              <div
                key={pid}
                className="grid grid-cols-[50px_52px_72px_1fr] gap-2 px-2.5 py-1.5 text-[10.5px] font-mono border-b border-[#2b2b30] last:border-b-0"
              >
                <div>{pid}</div>
                <div>{cpu}</div>
                <div>{mem}</div>
                <div className="text-[color:var(--muted)] truncate">{cmd}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-0.5">
            <span className="text-[10px] text-[color:var(--muted)] font-mono">
              Updated just now
            </span>
            <span className="inline-flex text-[10px] font-medium px-2.5 py-1 rounded-[4px] bg-[#3a1f22] text-[#ff9999] border border-[#5a2a2e]">
              Kill All
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#25252a] border border-[color:var(--border)] px-2.5 py-1.5">
      <div className="text-[8.5px] uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-[13px] font-semibold font-mono">{value}</div>
    </div>
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

function GitHubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1C5.925 1 1 5.925 1 12c0 4.867 3.155 8.989 7.531 10.447.55.101.75-.238.75-.53 0-.263-.01-1.134-.015-2.056-3.063.666-3.71-1.297-3.71-1.297-.5-1.273-1.222-1.61-1.222-1.61-1-.681.076-.667.076-.667 1.105.078 1.685 1.134 1.685 1.134.98 1.68 2.572 1.196 3.2.914.1-.71.385-1.195.7-1.47-2.445-.278-5.015-1.223-5.015-5.443 0-1.202.43-2.185 1.134-2.955-.114-.279-.492-1.4.108-2.917 0 0 .925-.296 3.03 1.128.88-.245 1.824-.367 2.763-.371.94.004 1.884.126 2.764.371 2.104-1.424 3.027-1.128 3.027-1.128.601 1.517.223 2.638.11 2.917.706.77 1.133 1.753 1.133 2.955 0 4.23-2.574 5.162-5.027 5.435.394.34.746 1.01.746 2.037 0 1.47-.013 2.654-.013 3.015 0 .294.198.636.755.528C19.85 20.984 23 16.864 23 12c0-6.075-4.925-11-11-11Z" />
    </svg>
  );
}
