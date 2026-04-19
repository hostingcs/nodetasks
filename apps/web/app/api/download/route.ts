import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { ensureSchema, getSql } from "@/lib/db";

const GITHUB_REPO = "hostingcs/nodetasks";
const FALLBACK_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

type Release = {
  tag_name?: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
  }>;
};

async function fetchLatestExe(): Promise<{
  url: string;
  version: string | null;
  asset: string | null;
}> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        next: { revalidate: 300 },
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (!res.ok) return { url: FALLBACK_URL, version: null, asset: null };
    const release = (await res.json()) as Release;
    const installer = release.assets?.find((a) =>
      a.name.toLowerCase().endsWith("-setup.exe")
    );
    const portable = release.assets?.find(
      (a) =>
        a.name.toLowerCase().endsWith(".exe") &&
        !a.name.toLowerCase().endsWith("-setup.exe")
    );
    const pick = installer ?? portable;
    if (!pick) return { url: FALLBACK_URL, version: null, asset: null };
    return {
      url: pick.browser_download_url,
      version: release.tag_name?.replace(/^v/, "") ?? null,
      asset: pick.name,
    };
  } catch {
    return { url: FALLBACK_URL, version: null, asset: null };
  }
}

function hashIp(ip: string, dayKey: string): string {
  const salt = process.env.PIXEL_SALT || "nt-default-salt-change-me";
  return crypto
    .createHash("sha256")
    .update(`${ip}|${dayKey}|${salt}`)
    .digest("hex")
    .slice(0, 16);
}

function truncate(s: string | null, max = 500): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function GET(req: NextRequest) {
  const { url, version, asset } = await fetchLatestExe();

  const referrer = truncate(req.headers.get("referer"));
  const ua = truncate(req.headers.get("user-agent"));
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-railway-country") ||
    null;
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const ipHash = ip ? hashIp(ip, new Date().toISOString().slice(0, 10)) : null;

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO downloads (version, asset, referrer, user_agent, country, ip_hash)
      VALUES (${version}, ${asset}, ${referrer}, ${ua}, ${country}, ${ipHash})
    `;
  } catch (err) {
    console.error("download: log failed", err);
  }

  return Response.redirect(url, 302);
}
