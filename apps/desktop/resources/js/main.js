const POLL_INTERVAL_MS = 1500;

const PS_LIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$list = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Select-Object ProcessId, CommandLine, WorkingSetSize,
    @{N='CpuTime'; E={ ($_.KernelModeTime + $_.UserModeTime) / 10000000 }})
if ($list.Count -eq 0) { '[]' }
else { ConvertTo-Json -InputObject $list -Compress -Depth 3 }
`.trim();

const PS_KILL_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
`.trim();

const PS_CORES_SCRIPT = `[Environment]::ProcessorCount`;

const AUTOSTART_REG_KEY = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_REG_NAME = "NodeTasks";
const AUTOSTART_ARG = "--autostart";

const prevSamples = new Map();
let numCores = 1;
let pollTimer = null;
let pollInFlight = false;
let autostartEnabled = false;

function encodePsCommand(script) {
  const bytes = new Uint8Array(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    const c = script.charCodeAt(i);
    bytes[i * 2] = c & 0xff;
    bytes[i * 2 + 1] = (c >> 8) & 0xff;
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function psCommand(script) {
  return `powershell -NoProfile -NonInteractive -EncodedCommand ${encodePsCommand(script)}`;
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function cleanCommand(cmd) {
  if (!cmd) return '(unknown)';
  return cmd.replace(/^"?[A-Za-z]:\\[^"]*?node\.exe"?\s*/i, '').trim() || cmd;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function detectCores() {
  try {
    const r = await Neutralino.os.execCommand(psCommand(PS_CORES_SCRIPT));
    const n = parseInt((r.stdOut || '').trim(), 10);
    if (n > 0) numCores = n;
  } catch (e) {
    console.error('detectCores failed', e);
  }
}

async function fetchNodeProcesses() {
  const result = await Neutralino.os.execCommand(psCommand(PS_LIST_SCRIPT));
  const raw = (result.stdOut || '').trim();
  if (!raw) return [];
  try {
    let data = JSON.parse(raw);
    if (!Array.isArray(data)) data = [data];
    return data;
  } catch (e) {
    console.error('JSON parse failed', e, raw);
    return [];
  }
}

function computeCpuPercent(pid, cpuTime, now) {
  const prev = prevSamples.get(pid);
  prevSamples.set(pid, { cpuTime, ts: now });
  if (!prev) return null;
  const dtSec = (now - prev.ts) / 1000;
  if (dtSec <= 0) return null;
  const dCpu = cpuTime - prev.cpuTime;
  const pct = (dCpu / dtSec) * 100 / numCores;
  return Math.max(0, pct);
}

function render(processes) {
  const list = document.getElementById('process-list');
  const empty = document.getElementById('empty-state');
  const statCount = document.getElementById('stat-count');
  const statCpu = document.getElementById('stat-cpu');
  const statMem = document.getElementById('stat-mem');
  const status = document.getElementById('status');
  const killBtn = document.getElementById('kill-all');

  const now = Date.now();
  const seen = new Set();
  let totalCpu = 0;
  let totalMem = 0;
  let anyCpu = false;

  const rows = processes.map(p => {
    const pid = p.ProcessId;
    const mem = p.WorkingSetSize || 0;
    const cpuTime = typeof p.CpuTime === 'number' ? p.CpuTime : 0;
    const cmd = cleanCommand(p.CommandLine || '');
    const cpuPct = computeCpuPercent(pid, cpuTime, now);
    seen.add(pid);
    totalMem += mem;
    if (cpuPct !== null) { totalCpu += cpuPct; anyCpu = true; }
    return { pid, mem, cpuPct, cmd };
  });

  for (const pid of Array.from(prevSamples.keys())) {
    if (!seen.has(pid)) prevSamples.delete(pid);
  }

  rows.sort((a, b) => {
    const ac = a.cpuPct ?? -1;
    const bc = b.cpuPct ?? -1;
    if (bc !== ac) return bc - ac;
    return b.mem - a.mem;
  });

  list.innerHTML = rows.map(r => `
    <div class="row">
      <div class="col-pid">${r.pid}</div>
      <div class="col-cpu">${r.cpuPct === null ? '—' : r.cpuPct.toFixed(1) + '%'}</div>
      <div class="col-mem">${formatBytes(r.mem)}</div>
      <div class="col-cmd" title="${escapeHtml(r.cmd)}">${escapeHtml(r.cmd)}</div>
    </div>
  `).join('');

  empty.classList.toggle('show', rows.length === 0);
  statCount.textContent = rows.length;
  statCpu.textContent = rows.length === 0 ? '—' : (anyCpu ? totalCpu.toFixed(1) + '%' : '…');
  statMem.textContent = formatBytes(totalMem);
  killBtn.disabled = rows.length === 0;

  status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const procs = await fetchNodeProcesses();
    render(procs);
  } catch (e) {
    console.error('poll failed', e);
    document.getElementById('status').textContent = 'Update failed';
  } finally {
    pollInFlight = false;
  }
}

async function killAll() {
  const killBtn = document.getElementById('kill-all');
  const status = document.getElementById('status');
  killBtn.disabled = true;
  status.textContent = 'Killing…';
  try {
    await Neutralino.os.execCommand(psCommand(PS_KILL_SCRIPT));
  } catch (e) {
    console.error('killAll failed', e);
  }
  prevSamples.clear();
  await poll();
}

async function onWindowClose() {
  try {
    await Neutralino.window.hide();
  } catch (e) {
    console.error('hide failed', e);
    Neutralino.app.exit();
  }
}

async function setupTray() {
  try {
    await Neutralino.os.setTray({
      icon: '/resources/icons/trayIcon.png',
      menuItems: [
        { id: 'SHOW', text: 'Show NodeTasks' },
        { id: 'SEP1', text: '-' },
        {
          id: 'AUTOSTART',
          text: 'Start with Windows',
          isChecked: autostartEnabled,
        },
        { id: 'SEP2', text: '-' },
        { id: 'QUIT', text: 'Quit' },
      ],
    });
  } catch (e) {
    console.error('setTray failed', e);
  }
}

async function onTrayMenuItemClicked(event) {
  switch (event.detail.id) {
    case 'SHOW':
      await Neutralino.window.show();
      try {
        await Neutralino.window.focus();
      } catch {}
      break;
    case 'AUTOSTART':
      await toggleAutostart();
      break;
    case 'QUIT':
      Neutralino.app.exit();
      break;
  }
}

function exePath() {
  const base = typeof NL_PATH === 'string' ? NL_PATH : '';
  return `${base.replace(/[\\/]+$/, '')}\\NodeTasks.exe`;
}

async function readAutostartState() {
  const script = `
    $val = (Get-ItemProperty -Path '${AUTOSTART_REG_KEY}' -Name '${AUTOSTART_REG_NAME}' -ErrorAction SilentlyContinue).${AUTOSTART_REG_NAME}
    if ($val) { 'yes' } else { 'no' }
  `.trim();
  try {
    const r = await Neutralino.os.execCommand(psCommand(script));
    return (r.stdOut || '').trim() === 'yes';
  } catch (e) {
    console.error('readAutostartState failed', e);
    return false;
  }
}

async function writeAutostart(enabled) {
  const script = enabled
    ? `
        $exe = '${exePath().replace(/'/g, "''")}'
        $cmd = '"' + $exe + '" ${AUTOSTART_ARG}'
        New-ItemProperty -Path '${AUTOSTART_REG_KEY}' -Name '${AUTOSTART_REG_NAME}' -Value $cmd -PropertyType String -Force | Out-Null
      `.trim()
    : `
        Remove-ItemProperty -Path '${AUTOSTART_REG_KEY}' -Name '${AUTOSTART_REG_NAME}' -ErrorAction SilentlyContinue
      `.trim();
  await Neutralino.os.execCommand(psCommand(script));
}

async function toggleAutostart() {
  const next = !autostartEnabled;
  try {
    await writeAutostart(next);
    autostartEnabled = next;
  } catch (e) {
    console.error('toggleAutostart failed', e);
  }
  await setupTray();
}

function compareVersions(a, b) {
  const parse = s => String(s || '').split('.').map(n => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function showUpdateBanner(version) {
  const banner = document.getElementById('update-banner');
  const versionEl = document.getElementById('update-version');
  const btn = document.getElementById('update-restart');
  if (!banner) return;
  versionEl.textContent = 'v' + version;
  banner.hidden = false;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Restarting…';
    try {
      await Neutralino.app.restartProcess();
    } catch (e) {
      console.error('restart failed', e);
    }
  });
}

async function checkForUpdate() {
  const url = typeof NL_UPDATE_MANIFEST_URL === 'string' ? NL_UPDATE_MANIFEST_URL : '';
  if (!url || url.includes('CHANGE-ME')) return;
  try {
    const manifest = await Neutralino.updater.checkForUpdates(url);
    if (!manifest || !manifest.version) return;
    if (compareVersions(manifest.version, NL_APPVERSION) <= 0) return;
    await Neutralino.updater.install();
    showUpdateBanner(manifest.version);
  } catch (e) {
    // Silent — offline, no release yet, etc.
    console.warn('update check failed', e);
  }
}

async function start() {
  Neutralino.init();
  Neutralino.events.on('windowClose', onWindowClose);
  Neutralino.events.on('trayMenuItemClicked', onTrayMenuItemClicked);

  const args = Array.isArray(NL_ARGS) ? NL_ARGS : [];
  if (args.includes(AUTOSTART_ARG)) {
    try {
      await Neutralino.window.hide();
    } catch (e) {
      console.error('initial hide failed', e);
    }
  }

  document.getElementById('kill-all').addEventListener('click', killAll);

  autostartEnabled = await readAutostartState();
  setupTray();

  await detectCores();
  await poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  checkForUpdate();
}

start();
