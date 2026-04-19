import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __nt_pgSql: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var __nt_schemaReady: boolean | undefined;
}

export function getSql(): postgres.Sql {
  if (globalThis.__nt_pgSql) return globalThis.__nt_pgSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false,
  });
  globalThis.__nt_pgSql = sql;
  return sql;
}

export async function ensureSchema(): Promise<void> {
  if (globalThis.__nt_schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      country TEXT,
      ip_hash TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_path ON events(path)`;
  globalThis.__nt_schemaReady = true;
}
