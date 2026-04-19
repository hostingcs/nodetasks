import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { ensureSchema, getSql } from "@/lib/db";

// 1x1 transparent PNG
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
  "base64"
);

const PIXEL_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "no-store, max-age=0",
  "Content-Length": String(PIXEL_PNG.length),
} as const;

function truncate(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function hashIp(ip: string, dayKey: string): string {
  const salt = process.env.PIXEL_SALT || "nt-default-salt-change-me";
  return crypto
    .createHash("sha256")
    .update(`${ip}|${dayKey}|${salt}`)
    .digest("hex")
    .slice(0, 16);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const path = truncate(url.searchParams.get("p") || "/", 500);
  const referrer = truncate(url.searchParams.get("r"), 500);
  const ua = truncate(req.headers.get("user-agent"), 500);
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-railway-country") ||
    null;

  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const dayKey = new Date().toISOString().slice(0, 10);
  const ipHash = ip ? hashIp(ip, dayKey) : null;

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO events (path, referrer, user_agent, country, ip_hash)
      VALUES (${path}, ${referrer}, ${ua}, ${country}, ${ipHash})
    `;
  } catch (err) {
    console.error("pixel: insert failed", err);
  }

  return new Response(PIXEL_PNG, { headers: PIXEL_HEADERS });
}
