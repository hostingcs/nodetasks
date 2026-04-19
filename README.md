# NodeTasks

A tiny native Windows app that monitors every running `node.exe`, shows live CPU / memory, and lets you kill them all with one click.

[**Download for Windows →**](https://github.com/hostingcs/nodetasks/releases/latest) · [nodetasks.com](https://nodetasks.com)

## Structure

```
.
├── apps/
│   └── desktop/            Neutralinojs app (Windows .exe, ~2 MB)
├── installer/
│   └── nodetasks.nsi       NSIS installer script
├── scripts/
│   ├── generate-icons.mjs  SVG → PNG/ICO pipeline
│   └── embed-exe-icon.mjs  PE icon/version embed (deferred — see workflow notes)
├── assets/
│   └── brand-mark.svg      Source SVG for all icons
├── .github/workflows/
│   └── release.yml         Tag-driven Windows build + release
└── manifest.json           Updater manifest consumed by the app via raw.githubusercontent.com
```

The marketing website (nodetasks.com) lives in a separate private repo: `hostingcs/nodetasks-web`.

## Develop

Requires Node 20+.

```sh
npm install

# First-time only: download Neutralino runtime binaries
npm run desktop:update-bin

# Run the desktop app (hot-reloads on file changes)
npm run desktop:run
```

## Release

Tag and push — CI builds the Windows installer + portable ZIP and publishes a GitHub Release.

```sh
git tag v1.0.5
git push origin v1.0.5
```

Workflow steps:

1. Sync version from tag into `neutralino.config.json` + `package.json`.
2. Build `NodeTasks.exe` + `resources.neu` via `neu build --release`.
3. Package a Windows installer (`NodeTasks-Setup.exe`) via NSIS.
4. Build a portable ZIP containing the exe + resources.
5. Create a GitHub Release with all three assets attached.
6. Rewrite `manifest.json` on `main` to point at the new release — the desktop app reads it via `raw.githubusercontent.com` and auto-updates.

## Auto-update

Desktop app launches → fetches `https://raw.githubusercontent.com/hostingcs/nodetasks/main/manifest.json` → if a newer version is published, downloads the new `resources.neu` from the GitHub release and swaps it. The update check and download both use the Chromium webview's `fetch()` (Neutralino's built-in HTTP client can't handle GitHub's 302 redirects).

Changes to the Neutralino runtime itself (the native `bin/neutralino-win_x64.exe`) require a fresh `.exe` download — users reinstall via the installer or portable ZIP.

## Icons

All icons — favicon, apple-icon, PWA icons, desktop window/tray icons, and the `.exe` file icon — are generated from `assets/brand-mark.svg`:

```sh
npm run generate:icons
```

## Code signing

Windows binaries are code-signed through [SignPath.io](https://signpath.org/) using a certificate issued by the [SignPath Foundation](https://signpath.org/), a non-profit that provides free code signing to open source projects.

## License

MIT
