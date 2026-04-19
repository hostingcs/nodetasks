# NodeTasks

A tiny native Windows app that monitors every running `node.exe`, shows live CPU / memory, and lets you kill them all with one click.

## Structure

```
.
├── apps/
│   ├── desktop/   Neutralinojs app (Windows .exe, ~2 MB)
│   └── web/       Next.js landing + update manifest
└── .github/
    └── workflows/release.yml
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
npm run web:dev
```

## Release

Tag and push — CI builds the Windows binary and publishes a GitHub Release.

```sh
git tag v1.0.1
git push origin v1.0.1
```

The workflow:

1. Syncs the version from the tag into `neutralino.config.json` and `package.json`.
2. Builds `NodeTasks-win_x64.exe` + `resources.neu`.
3. Creates a GitHub Release with both as attached assets.
4. The website's `/updates/manifest.json` picks up the new release automatically (5 min cache).
5. Running apps check the manifest on launch and silently install the new resources bundle. The user gets a banner offering to restart.

## Update mechanism

On launch, the desktop app hits `UPDATE_MANIFEST_URL` (set in `apps/desktop/neutralino.config.json` under `globalVariables`). Change this to your deployed site URL before the first release.

Neutralino's updater replaces the `resources.neu` bundle in place — meaning HTML/CSS/JS changes ship via the updater. Changes to the native runtime (`bin/neutralino-win_x64.exe`) require a fresh `.exe` download.

## License

MIT
