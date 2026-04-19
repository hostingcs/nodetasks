import { ensureSchema, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DailyRow = { day: Date; c: number };
type PathRow = { path: string; c: number };
type RefRow = { referrer: string | null; c: number };

type Stats = {
  total: number;
  last24h: number;
  last7d: number;
  last30d: number;
  uniques30d: number;
  daily: DailyRow[];
  topPaths: PathRow[];
  topReferrers: RefRow[];
  dl: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
    daily: DailyRow[];
    topReferrers: RefRow[];
  };
};

async function fetchStats(): Promise<Stats> {
  await ensureSchema();
  const sql = getSql();

  const [
    [totalR],
    [r24h],
    [r7d],
    [r30d],
    [uniques],
    rawDaily,
    topPaths,
    topReferrers,
    [dlTotalR],
    [dl24h],
    [dl7d],
    [dl30d],
    rawDlDaily,
    dlTopReferrers,
  ] = await Promise.all([
    sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM events`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM events WHERE ts >= NOW() - INTERVAL '24 hours'`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM events WHERE ts >= NOW() - INTERVAL '7 days'`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM events WHERE ts >= NOW() - INTERVAL '30 days'`,
    sql<
      { c: number }[]
    >`SELECT COUNT(DISTINCT ip_hash)::int AS c FROM events WHERE ts >= NOW() - INTERVAL '30 days' AND ip_hash IS NOT NULL`,
    sql<{ day: Date; c: number }[]>`
      SELECT date_trunc('day', ts) AS day, COUNT(*)::int AS c
      FROM events
      WHERE ts >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,
    sql<{ path: string; c: number }[]>`
      SELECT path, COUNT(*)::int AS c
      FROM events
      WHERE ts >= NOW() - INTERVAL '30 days'
      GROUP BY path ORDER BY c DESC LIMIT 10
    `,
    sql<{ referrer: string | null; c: number }[]>`
      SELECT referrer, COUNT(*)::int AS c
      FROM events
      WHERE ts >= NOW() - INTERVAL '30 days'
        AND referrer IS NOT NULL AND referrer <> ''
      GROUP BY referrer ORDER BY c DESC LIMIT 10
    `,
    sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM downloads`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM downloads WHERE ts >= NOW() - INTERVAL '24 hours'`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM downloads WHERE ts >= NOW() - INTERVAL '7 days'`,
    sql<
      { c: number }[]
    >`SELECT COUNT(*)::int AS c FROM downloads WHERE ts >= NOW() - INTERVAL '30 days'`,
    sql<{ day: Date; c: number }[]>`
      SELECT date_trunc('day', ts) AS day, COUNT(*)::int AS c
      FROM downloads
      WHERE ts >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,
    sql<{ referrer: string | null; c: number }[]>`
      SELECT referrer, COUNT(*)::int AS c
      FROM downloads
      WHERE ts >= NOW() - INTERVAL '30 days'
        AND referrer IS NOT NULL AND referrer <> ''
      GROUP BY referrer ORDER BY c DESC LIMIT 10
    `,
  ]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const fill30 = (rows: { day: Date; c: number }[]): DailyRow[] => {
    const byKey = new Map<string, number>();
    for (const r of rows) {
      byKey.set(new Date(r.day).toISOString().slice(0, 10), r.c);
    }
    const out: DailyRow[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      out.push({
        day: d,
        c: byKey.get(d.toISOString().slice(0, 10)) ?? 0,
      });
    }
    return out;
  };

  return {
    total: totalR?.c ?? 0,
    last24h: r24h?.c ?? 0,
    last7d: r7d?.c ?? 0,
    last30d: r30d?.c ?? 0,
    uniques30d: uniques?.c ?? 0,
    daily: fill30(rawDaily),
    topPaths,
    topReferrers,
    dl: {
      total: dlTotalR?.c ?? 0,
      last24h: dl24h?.c ?? 0,
      last7d: dl7d?.c ?? 0,
      last30d: dl30d?.c ?? 0,
      daily: fill30(rawDlDaily),
      topReferrers: dlTopReferrers,
    },
  };
}

export default async function AdminPage() {
  let stats: Stats | null = null;
  let error: string | null = null;
  try {
    stats = await fetchStats();
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <h2 className="text-base font-semibold">Unable to load analytics</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">{error}</p>
        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Check that <code>DATABASE_URL</code> is set and reachable from this
          environment.
        </p>
      </div>
    );
  }

  if (!stats) return null;

  const convRate =
    stats.last30d > 0 ? (stats.dl.last30d / stats.last30d) * 100 : 0;

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <SectionTitle label="Traffic" />
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card label="All-time" value={stats.total} />
          <Card label="Last 24h" value={stats.last24h} />
          <Card label="Last 7d" value={stats.last7d} />
          <Card label="Last 30d" value={stats.last30d} />
          <Card label="Uniques 30d" value={stats.uniques30d} hint="by ip+day" />
        </section>

        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="text-sm font-semibold mb-4">
            Daily page views · last 30 days
          </h2>
          <DailyChart data={stats.daily} />
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <TopList
            title="Top paths · 30d"
            rows={stats.topPaths.map((r) => ({
              label: r.path,
              count: r.c,
            }))}
          />
          <TopList
            title="Top referrers · 30d"
            rows={stats.topReferrers.map((r) => ({
              label: r.referrer || "(direct)",
              count: r.c,
            }))}
          />
        </section>
      </div>

      <div className="space-y-6">
        <SectionTitle label="Downloads" />
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card label="All-time" value={stats.dl.total} />
          <Card label="Last 24h" value={stats.dl.last24h} />
          <Card label="Last 7d" value={stats.dl.last7d} />
          <Card label="Last 30d" value={stats.dl.last30d} />
          <Card
            label="Conv. 30d"
            value={Math.round(convRate * 10) / 10}
            suffix="%"
            hint="downloads ÷ visits"
          />
        </section>

        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="text-sm font-semibold mb-4">
            Daily downloads · last 30 days
          </h2>
          <DailyChart data={stats.dl.daily} color="#7ad9a9" />
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <TopList
            title="Download referrers · 30d"
            rows={stats.dl.topReferrers.map((r) => ({
              label: r.referrer || "(direct)",
              count: r.c,
            }))}
          />
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5 text-xs text-[color:var(--muted)] leading-relaxed">
            <h2 className="text-sm font-semibold text-[color:var(--foreground)] mb-2">
              About this counter
            </h2>
            <p>
              Downloads shown here only count click-throughs via{" "}
              <code className="font-mono text-[color:var(--foreground)]">
                /api/download
              </code>{" "}
              on this site. Direct downloads from GitHub Releases aren&apos;t
              included. The homepage shows the authoritative total from the
              GitHub Releases API.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h1 className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)] font-semibold">
      {label}
    </h1>
  );
}

function Card({
  label,
  value,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString()}
        {suffix ? (
          <span className="text-sm text-[color:var(--muted)] ml-0.5">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function DailyChart({
  data,
  color = "#4da6ff",
}: {
  data: DailyRow[];
  color?: string;
}) {
  const W = 800;
  const H = 160;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(1, ...data.map((d) => d.c));
  const barW = plotW / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        preserveAspectRatio="none"
      >
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={H - PAD_B}
          y2={H - PAD_B}
          stroke="#2b2b30"
        />
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + (1 - t) * plotH}
              y2={PAD_T + (1 - t) * plotH}
              stroke="#232328"
              strokeDasharray="3 3"
            />
            <text
              x={PAD_L - 6}
              y={PAD_T + (1 - t) * plotH + 3}
              fontSize="9"
              fill="#6a6a72"
              textAnchor="end"
            >
              {Math.round(max * t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const h = (d.c / max) * plotH;
          const x = PAD_L + i * barW + 1;
          const y = PAD_T + (plotH - h);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(1, barW - 2)}
              height={Math.max(1, h)}
              fill={color}
              opacity={0.85}
            >
              <title>
                {d.day.toISOString().slice(0, 10)}: {d.c}
              </title>
            </rect>
          );
        })}

        {[0, 7, 14, 21, 29].map((i) => (
          <text
            key={i}
            x={PAD_L + i * barW + barW / 2}
            y={H - 8}
            fontSize="9"
            fill="#6a6a72"
            textAnchor="middle"
          >
            {data[i]?.day.toISOString().slice(5, 10)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function TopList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-[color:var(--muted)]">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="relative">
              <div
                className="absolute inset-y-0 left-0 rounded bg-[color:var(--accent)]/10"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between text-xs px-2 py-1.5 gap-4">
                <span className="truncate text-[color:var(--foreground)]">
                  {r.label}
                </span>
                <span className="tabular-nums text-[color:var(--muted)]">
                  {r.count.toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
