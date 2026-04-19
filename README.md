<p align="center">
  <img src="assets/brand-mark.svg" width="80" alt="NodeTasks logo">
</p>

<h1 align="center">NodeTasks</h1>

<p align="center">
  <strong>Monitor every Node.js process on your Windows machine.</strong><br>
  Tiny, native, one-click Kill All.
</p>

<p align="center">
  <a href="https://nodetasks.com">nodetasks.com</a>
  ·
  <a href="https://github.com/hostingcs/nodetasks/releases/latest">Download</a>
  ·
  <a href="https://github.com/hostingcs/nodetasks/issues">Issues</a>
</p>

<p align="center">
  <a href="https://github.com/hostingcs/nodetasks/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/hostingcs/nodetasks?color=4da6ff&label=release"></a>
  <a href="https://github.com/hostingcs/nodetasks/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/hostingcs/nodetasks/total?color=4da6ff"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows_10%2F11-0078d4?logo=windows&logoColor=white">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/hostingcs/nodetasks?color=4da6ff"></a>
</p>

---

## Why

Windows Task Manager doesn't filter to just Node processes, and killing a dozen stale dev servers one at a time is tedious. NodeTasks is a single small window that shows every `node.exe` on your system with live CPU and memory, and terminates them all with one click.

## Features

- Live **CPU %** and **memory** per `node.exe`, refreshed every 1.5 s
- **Combined totals** across every Node process
- **Kill All** button — or right-click a row to kill just that one
- Right-click → **Open folder location** jumps to the script's directory in Explorer
- Closes to the **system tray** — right-click tray for Show / Quit
- **Start with Windows** toggle in settings (opt-in)
- **Auto-updates** on launch (no re-install for most changes)
- Under **3 MB** download, typically < 30 MB RAM at runtime
- Code-signed Windows binaries via the [SignPath Foundation](https://signpath.org/)

## Install

[**Download NodeTasks-Setup.exe**](https://github.com/hostingcs/nodetasks/releases/latest) from the latest release, or grab the portable ZIP from the same page if you prefer not to install.

Requires **Windows 10 or Windows 11, 64-bit**. The installer is per-user (no UAC prompt) and adds Start Menu + Desktop shortcuts plus an uninstaller.

## How it works

NodeTasks is built on [Neutralinojs](https://neutralino.js.org/) — a lightweight alternative to Electron that uses the system WebView2 instead of bundling Chromium. The result is a ~2 MB executable plus a small web resources bundle.

- Every 1.5 s the app queries WMI (`Win32_Process` filtered to `node.exe`) via PowerShell for PID, command line, memory, and CPU time.
- **CPU %** is computed by sampling the kernel + user CPU time across polls: `Δcpu / Δtime / coreCount`.
- **Kill All** runs `Get-Process node | Stop-Process -Force`; single-kill runs `Stop-Process -Id <pid> -Force`.
- **Open folder** parses the script path out of the command line and opens its directory in Explorer.
- **Auto-update** fetches `manifest.json` from `raw.githubusercontent.com`, downloads the new `resources.neu` from the matching GitHub Release, and swaps it in place. The check and install both use the Chromium webview's `fetch()`, which follows GitHub's redirects correctly.

## Develop

Requires **Node 20+**.

```sh
git clone https://github.com/hostingcs/nodetasks
cd nodetasks
npm install
npm run desktop:update-bin   # first time — downloads the Neutralino runtime
npm run desktop:run           # hot-reloads on file changes
```

## Release

Tag and push — CI builds everything on an Ubuntu runner and publishes a GitHub Release.

```sh
git tag v1.2.3
git push origin v1.2.3
```

The workflow:

1. Syncs the version from the tag into `neutralino.config.json` + `package.json`.
2. Builds `NodeTasks.exe` + `resources.neu` via `neu build --release`.
3. Packages a Windows installer (`NodeTasks-Setup.exe`) with NSIS.
4. Builds a portable ZIP with the exe + resources.
5. Creates a GitHub Release with all three assets.
6. Rewrites `manifest.json` on `main` — running installs pick up the new version on their next launch.

## Structure

```
.
├── apps/desktop/         Neutralinojs app (Windows .exe, ~2 MB)
├── installer/            NSIS installer script
├── scripts/              Icon generation + PE metadata utilities
├── assets/               Source SVG for all icons
├── .github/workflows/    Tag-driven release pipeline
└── manifest.json         Updater manifest (served via raw.githubusercontent.com)
```

The marketing website at [nodetasks.com](https://nodetasks.com) — landing, download, privacy, admin, analytics — lives in a separate private repo and is not required to build or run the desktop app.

## Icons

Every icon — favicon, PWA icons, the window icon, the tray icon, and the `.exe` file icon — is generated from `assets/brand-mark.svg`:

```sh
npm run generate:icons
```

## Code signing

NodeTasks Windows binaries are code-signed through [SignPath.io](https://signpath.org/) using a certificate issued by the [SignPath Foundation](https://signpath.org/), a non-profit that provides free code signing to open source projects.

You can verify the signature on any released binary by right-clicking the file in Explorer → **Properties** → **Digital Signatures**.

## Contributing

Bug reports, feature ideas, and PRs are welcome — open an [issue](https://github.com/hostingcs/nodetasks/issues) first for anything non-trivial.

## License

[MIT](LICENSE).
