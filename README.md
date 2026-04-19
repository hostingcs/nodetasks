# NodeTasks

A tiny native Windows app that monitors every running `node.exe`, shows live CPU / memory, and lets you kill them all with one click.

## Structure

```
.
├── apps/
│   ├── desktop/         Neutralinojs app (Windows .exe, ~2 MB)
│   └── web/             Next.js landing + admin/analytics
├── scripts/
│   ├── generate-icons.mjs    SVG → PNG/ICO pipeline
│   └── embed-exe-icon.mjs    rcedit-style icon/version embed
├── assets/
│   └── brand-mark.svg   Source SVG for all icons
└── .github/workflows/
    └── release.yml      Tag-driven Windows build + release
```

## Develop

Requires Node 20+.

```sh
npm install

# First-time only: download Neutralino runtime binaries
npm run desktop:update-bin

# Run the desktop app (hot-reloads on file changes)
npm run desktop:run

# Run the website
cp apps/web/.env.example apps/web/.env.local  # fill in values
npm run web:dev
```

## Web environment variables

Copy `apps/web/.env.example` to `.env.local` (local) or set them on Railway (production):

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Railway auto-populates this from the Postgres plugin) |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `AUTH_SECRET` | 32+ char random string used to sign session cookies |
| `PIXEL_SALT` | Random salt for daily IP hashing in analytics |

Generate a good `AUTH_SECRET`:
```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

The `events` table is auto-created on first pixel hit — no migrations to run.

## Admin + analytics

- **Pixel endpoint**: `GET /api/pixel?p=<path>&r=<referrer>` logs to Postgres and returns a 1x1 PNG.
- **Client snippet**: `app/components/analytics.tsx` fires the pixel on every client-side navigation. Admin paths are excluded.
- **Privacy**: IP is never stored raw — it's hashed with `PIXEL_SALT + daily key`, giving a 24h dedup window.
- **Admin dashboard**: `/admin` — cards for totals, daily chart, top paths, top referrers. Protected by `proxy.ts`.

## SEO

- `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts` — all Next file conventions.
- Rich metadata + JSON-LD `SoftwareApplication` schema in `app/layout.tsx`.
- Dynamic OG image at `/opengraph-image` built via `next/og`.

## Release

Tag and push — CI builds the Windows binary and publishes a GitHub Release.

```sh
git tag v1.0.1
git push origin v1.0.1
```

Workflow steps:

1. Sync version from tag into `neutralino.config.json` + `package.json`.
2. Build `NodeTasks-win_x64.exe` + `resources.neu`.
3. Embed brand icon + version info into the `.exe` via `resedit`.
4. Create GitHub Release with both assets attached.
5. `nodetasks.com/updates/manifest.json` picks up the new release (5 min cache).
6. Running apps check the manifest on launch, silently install the new resources bundle, and offer a restart.

## Icons

All icons — favicon, apple-icon, PWA icons, desktop window/tray icons, and the `.exe` file icon — are generated from `assets/brand-mark.svg`:

```sh
npm run generate:icons
```

## Update mechanism

On launch, the desktop app hits `UPDATE_MANIFEST_URL` (set in `apps/desktop/neutralino.config.json` under `globalVariables`). Neutralino's updater swaps the `resources.neu` bundle in place — HTML/CSS/JS changes ship via the updater. Changes to the native runtime (`bin/neutralino-win_x64.exe`) require a fresh `.exe` download.

## Close-to-tray

Closing the app window minimizes it to the system tray. Click the tray icon for a menu with **Show NodeTasks** and **Quit**.

## License

MIT
