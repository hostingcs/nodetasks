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

  list.innerHTML = rows
    .map(
      (r) => `
    <div class="row" data-pid="${r.pid}" data-cmd="${escapeHtml(
      rawCommandFor(r.pid, processes)
    )}">
      <div class="col-pid">${r.pid}</div>
      <div class="col-cpu">${r.cpuPct === null ? '—' : r.cpuPct.toFixed(1) + '%'}</div>
      <div class="col-mem">${formatBytes(r.mem)}</div>
      <div class="col-cmd" title="${escapeHtml(r.cmd)}">${escapeHtml(r.cmd)}</div>
    </div>
  `
    )
    .join('');

  empty.classList.toggle('show', rows.length === 0);
  statCount.textContent = rows.length;
  statCpu.textContent = rows.length === 0 ? '—' : (anyCpu ? totalCpu.toFixed(1) + '%' : '…');
  statMem.textContent = formatBytes(totalMem);
  killBtn.disabled = rows.length === 0;

  status.textContent = typeof NL_APPVERSION === 'string' ? 'v' + NL_APPVERSION : '';
}

function rawCommandFor(pid, processes) {
  const p = processes.find((p) => p.ProcessId === pid);
  return (p && p.CommandLine) || '';
}

function extractScriptPath(cmdLine) {
  if (!cmdLine) return null;
  let rest;
  const m1 = cmdLine.match(/^"[^"]+"\s*(.*)$/);
  if (m1) rest = m1[1];
  else {
    const m2 = cmdLine.match(/^\S+\s*(.*)$/);
    if (!m2) return null;
    rest = m2[1];
  }
  if (!rest) return null;
  if (rest.startsWith('-')) return null;
  const m3 = rest.match(/^"([^"]+)"/);
  if (m3) return m3[1];
  const m4 = rest.match(/^(\S+)/);
  return m4 ? m4[1] : null;
}

function folderOf(filePath) {
  if (!filePath) return null;
  const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  if (idx < 0) return null;
  return filePath.slice(0, idx);
}

const ctxState = { pid: null, cmd: '' };

function positionContextMenu(menu, x, y) {
  menu.hidden = false;
  // Position off-screen to measure
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nx = Math.min(x, vw - rect.width - 4);
  const ny = Math.min(y, vh - rect.height - 4);
  menu.style.left = Math.max(4, nx) + 'px';
  menu.style.top = Math.max(4, ny) + 'px';
}

function closeContextMenu() {
  const menu = document.getElementById('row-menu');
  if (menu) menu.hidden = true;
  ctxState.pid = null;
  ctxState.cmd = '';
}

async function killPid(pid) {
  const script = `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`;
  try {
    await Neutralino.os.execCommand(psCommand(script));
  } catch (e) {
    console.error('killPid failed', e);
  }
  prevSamples.delete(pid);
  await poll();
}

async function openProcessFolder(cmd) {
  const script = extractScriptPath(cmd);
  const folder = folderOf(script);
  if (!folder) return;
  try {
    await Neutralino.os.open(folder);
  } catch (e) {
    console.error('openProcessFolder failed', e);
  }
}

function wireContextMenu() {
  const list = document.getElementById('process-list');
  const menu = document.getElementById('row-menu');
  const pidLabel = document.getElementById('ctx-pid');
  if (!list || !menu) return;

  list.addEventListener('contextmenu', (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    const row = el && el.closest ? el.closest('.row') : null;
    if (!row) return;
    e.preventDefault();
    const pid = parseInt(row.getAttribute('data-pid') || '0', 10);
    const cmd = row.getAttribute('data-cmd') || '';
    if (!pid) return;
    ctxState.pid = pid;
    ctxState.cmd = cmd;
    if (pidLabel) pidLabel.textContent = 'PID ' + pid;

    const openFolderBtn = menu.querySelector('[data-action="open-folder"]');
    if (openFolderBtn) {
      const hasFolder = !!folderOf(extractScriptPath(cmd));
      openFolderBtn.disabled = !hasFolder;
    }

    positionContextMenu(menu, e.clientX, e.clientY);
  });

  menu.addEventListener('click', async (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    const btn = el && el.closest ? el.closest('.ctx-item') : null;
    if (!btn || btn.disabled) return;
    const action = btn.getAttribute('data-action');
    const { pid, cmd } = ctxState;
    closeContextMenu();
    if (action === 'kill' && pid) {
      await killPid(pid);
    } else if (action === 'open-folder') {
      await openProcessFolder(cmd);
    }
  });

  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    const el = /** @type {HTMLElement} */ (e.target);
    if (el && el.closest && el.closest('#row-menu')) return;
    closeContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);
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

async function setAutostart(enabled) {
  try {
    await writeAutostart(enabled);
    autostartEnabled = enabled;
  } catch (e) {
    console.error('setAutostart failed', e);
  }
  syncAutostartUi();
  await setupTray();
}

async function toggleAutostart() {
  await setAutostart(!autostartEnabled);
}

function syncAutostartUi() {
  const cb = document.getElementById('setting-autostart');
  if (cb) cb.checked = autostartEnabled;
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  syncAutostartUi();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function wireSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('open-settings');
  const cb = document.getElementById('setting-autostart');
  const versionEl = document.getElementById('modal-version');

  if (openBtn) openBtn.addEventListener('click', openSettings);
  if (modal) {
    modal.addEventListener('click', (e) => {
      const el = /** @type {HTMLElement} */ (e.target);
      if (el && el.closest && el.closest('[data-close]')) closeSettings();
    });
  }
  if (cb) {
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      try {
        await setAutostart(cb.checked);
      } finally {
        cb.disabled = false;
      }
    });
  }
  if (versionEl && typeof NL_APPVERSION === 'string') {
    versionEl.textContent = 'v' + NL_APPVERSION;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });
}

// ============ node_modules cleanup ============

const CLEANUP_DELETE_BATCH = 50;

const cleanupState = {
  root: '',
  results: [],
  selected: new Set(),
  deletedPaths: new Set(),
  lastClickedIdx: -1,
  useRecycle: true,
  busy: false,
};

function psQuote(s) {
  return String(s).replace(/'/g, "''");
}

function normalizeWinPath(p) {
  if (!p) return '';
  return String(p).replace(/\//g, '\\').replace(/\\+$/, '');
}

function validateCleanupRoot(p) {
  if (!p) return 'No folder selected.';
  const norm = normalizeWinPath(p);
  if (!norm) return 'No folder selected.';
  // Drive root, e.g. "C:", "C:\"
  if (/^[A-Za-z]:?\\?$/.test(norm)) {
    return 'Refusing to scan a drive root. Pick a specific folder.';
  }
  // UNC share root, e.g. "\\server\share"
  if (/^\\\\[^\\]+\\[^\\]+\\?$/.test(norm)) {
    return 'Refusing to scan a network share root. Pick a subfolder.';
  }
  const upper = norm.toUpperCase();
  const forbidden = [
    /^[A-Z]:\\WINDOWS(\\|$)/,
    /^[A-Z]:\\PROGRAM FILES( \(X86\))?(\\|$)/,
    /^[A-Z]:\\PROGRAMDATA(\\|$)/,
    /^[A-Z]:\\\$RECYCLE\.BIN(\\|$)/,
    /^[A-Z]:\\SYSTEM VOLUME INFORMATION(\\|$)/,
    /^[A-Z]:\\BOOT(\\|$)/,
    /^[A-Z]:\\RECOVERY(\\|$)/,
  ];
  for (const re of forbidden) {
    if (re.test(upper)) return 'Refusing to scan a system folder.';
  }
  // Reject the user profile root itself, but allow subfolders
  const profileRoot = /^([A-Z]:\\USERS\\[^\\]+)\\?$/.exec(upper);
  if (profileRoot) return 'Pick a specific folder under your profile.';
  return null;
}

function buildFindScript(rootPath) {
  const safe = psQuote(rootPath);
  return `
$ErrorActionPreference = 'SilentlyContinue'
$root = '${safe}'
if (-not (Test-Path -LiteralPath $root)) { '[]'; exit }

$results = New-Object System.Collections.Generic.List[object]
$stack = New-Object System.Collections.Generic.Stack[string]
$stack.Push($root)

while ($stack.Count -gt 0) {
  $current = $stack.Pop()
  try {
    $items = Get-ChildItem -LiteralPath $current -Directory -Force -ErrorAction SilentlyContinue
  } catch { continue }
  foreach ($it in $items) {
    if ($it.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
    if ($it.Name -ieq 'node_modules') {
      $size = 0L
      try {
        $di = New-Object System.IO.DirectoryInfo $it.FullName
        foreach ($f in $di.EnumerateFiles('*', [System.IO.SearchOption]::AllDirectories)) {
          $size += $f.Length
        }
      } catch { $size = 0L }
      $results.Add([pscustomobject]@{ Path = $it.FullName; Size = [int64]$size })
    } else {
      $stack.Push($it.FullName)
    }
  }
}

if ($results.Count -eq 0) { '[]' }
else { ConvertTo-Json -InputObject $results.ToArray() -Compress -Depth 3 }
`.trim();
}

function buildDeleteScript(paths, useRecycle) {
  const list = paths.map((p) => `'${psQuote(p)}'`).join(',');
  const mode = useRecycle ? 'true' : 'false';
  return `
$ErrorActionPreference = 'SilentlyContinue'
$useRecycle = $${mode}
$paths = @(${list})
$deleted = @()
$failed = @()
if ($useRecycle) { Add-Type -AssemblyName Microsoft.VisualBasic }
foreach ($p in $paths) {
  if (-not (Test-Path -LiteralPath $p)) { $deleted += $p; continue }
  $ok = $false
  if ($useRecycle) {
    try {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
        $p,
        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,
        [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
      $ok = $true
    } catch {}
  } else {
    try {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
      $ok = $true
    } catch {
      $tmp = Join-Path $env:TEMP ('nt_' + [guid]::NewGuid().ToString('N'))
      try {
        New-Item -ItemType Directory -Path $tmp -Force | Out-Null
        & robocopy.exe $tmp $p /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
        Remove-Item -LiteralPath $tmp -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
      } catch {}
      if (-not (Test-Path -LiteralPath $p)) { $ok = $true }
    }
  }
  if ($ok) { $deleted += $p } else { $failed += $p }
}
ConvertTo-Json -InputObject ([pscustomobject]@{ Deleted = @($deleted); Failed = @($failed) }) -Compress -Depth 3
`.trim();
}

async function runFindNodeModules(rootPath) {
  const script = buildFindScript(rootPath);
  const r = await Neutralino.os.execCommand(psCommand(script));
  const raw = (r.stdOut || '').trim();
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('cleanup scan parse failed', e, raw);
    throw new Error('Scan failed: could not parse results.');
  }
  if (!Array.isArray(data)) data = [data];
  return data
    .filter((d) => d && typeof d.Path === 'string')
    .map((d) => ({ path: d.Path, size: Number(d.Size) || 0 }));
}

async function runDeleteBatch(paths, useRecycle) {
  const script = buildDeleteScript(paths, useRecycle);
  const r = await Neutralino.os.execCommand(psCommand(script));
  const raw = (r.stdOut || '').trim();
  if (!raw) return { deleted: [], failed: paths.slice() };
  try {
    const j = JSON.parse(raw);
    return {
      deleted: Array.isArray(j.Deleted) ? j.Deleted : (j.Deleted ? [j.Deleted] : []),
      failed: Array.isArray(j.Failed) ? j.Failed : (j.Failed ? [j.Failed] : []),
    };
  } catch (e) {
    console.error('cleanup delete parse failed', e, raw);
    return { deleted: [], failed: paths.slice() };
  }
}

function relativeFromRoot(full, root) {
  const f = normalizeWinPath(full);
  const r = normalizeWinPath(root);
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + '\\')) {
    return f.slice(r.length + 1);
  }
  return f;
}

function setCleanupError(msg) {
  const el = document.getElementById('cleanup-error');
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
  } else {
    el.hidden = false;
    el.textContent = msg;
  }
}

function setCleanupStatus(msg) {
  const el = document.getElementById('cleanup-status');
  if (el) el.textContent = msg || '';
}

function setCleanupBusy(busy) {
  cleanupState.busy = busy;
  const ids = ['cleanup-choose', 'cleanup-rescan', 'cleanup-delete', 'cleanup-select-all', 'cleanup-recycle'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  }
  document.querySelectorAll('.cleanup-row-delete').forEach((b) => { b.disabled = busy; });
  if (!busy) updateCleanupDeleteBtn();
}

function getSelectedCleanupPaths() {
  return cleanupState.results
    .map((r) => r.path)
    .filter((p) => cleanupState.selected.has(p) && !cleanupState.deletedPaths.has(p));
}

function getActiveResults() {
  return cleanupState.results.filter((r) => !cleanupState.deletedPaths.has(r.path));
}

function updateCleanupDeleteBtn() {
  const btn = document.getElementById('cleanup-delete');
  if (!btn) return;
  if (cleanupState.busy) { btn.disabled = true; return; }
  const selected = getSelectedCleanupPaths();
  let total = 0;
  for (const p of selected) {
    const item = cleanupState.results.find((x) => x.path === p);
    if (item) total += item.size;
  }
  btn.disabled = selected.length === 0;
  const verb = cleanupState.useRecycle ? 'Recycle' : 'Delete';
  btn.textContent = selected.length === 0
    ? verb
    : `${verb} ${selected.length} folder${selected.length === 1 ? '' : 's'} (${formatBytes(total)})`;
}

function updateMasterCheckbox() {
  const cb = document.getElementById('cleanup-select-all');
  if (!cb) return;
  const active = getActiveResults();
  if (active.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }
  cb.disabled = cleanupState.busy;
  const selectedCount = active.filter((r) => cleanupState.selected.has(r.path)).length;
  cb.checked = selectedCount === active.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < active.length;
}

function setSelectionForRange(startIdx, endIdx, value) {
  if (startIdx < 0 || endIdx < 0) return;
  const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  for (let i = a; i <= b; i++) {
    const r = cleanupState.results[i];
    if (!r || cleanupState.deletedPaths.has(r.path)) continue;
    if (value) cleanupState.selected.add(r.path);
    else cleanupState.selected.delete(r.path);
  }
}

function renderCleanupResults() {
  const results = cleanupState.results;
  const root = cleanupState.root;
  const wrap = document.getElementById('cleanup-results');
  const empty = document.getElementById('cleanup-empty');
  const list = document.getElementById('cleanup-list');
  const summary = document.getElementById('cleanup-summary');
  if (!wrap || !empty || !list || !summary) return;

  if (results.length === 0) {
    wrap.hidden = true;
    empty.hidden = false;
    updateCleanupDeleteBtn();
    updateMasterCheckbox();
    return;
  }
  empty.hidden = true;
  wrap.hidden = false;

  const active = getActiveResults();
  const selectedActive = active.filter((r) => cleanupState.selected.has(r.path));
  const selectedSize = selectedActive.reduce((s, r) => s + r.size, 0);
  const totalSize = active.reduce((s, r) => s + r.size, 0);
  summary.textContent = active.length === 0
    ? 'All cleared'
    : `${selectedActive.length} of ${active.length} selected • ${formatBytes(selectedSize)} of ${formatBytes(totalSize)}`;

  list.innerHTML = results.map((r, i) => {
    const rel = relativeFromRoot(r.path, root) || r.path;
    const isDeleted = cleanupState.deletedPaths.has(r.path);
    const isSelected = cleanupState.selected.has(r.path) && !isDeleted;
    return `
      <div class="cleanup-row${isDeleted ? ' deleted' : ''}${isSelected ? ' selected' : ''}" data-path="${escapeHtml(r.path)}" data-idx="${i}">
        <input type="checkbox" tabindex="-1" ${isDeleted ? 'disabled' : ''} ${isSelected ? 'checked' : ''}>
        <span class="cleanup-path" title="${escapeHtml(r.path)}">${escapeHtml(rel)}</span>
        <span class="cleanup-size">${formatBytes(r.size)}</span>
        <button class="cleanup-row-delete" type="button" data-path="${escapeHtml(r.path)}" title="Delete this folder" aria-label="Delete this folder" ${isDeleted || cleanupState.busy ? 'disabled' : ''}>×</button>
      </div>
    `;
  }).join('');

  updateMasterCheckbox();
  updateCleanupDeleteBtn();
}

function setCleanupFolder(path) {
  cleanupState.root = path || '';
  cleanupState.results = [];
  cleanupState.selected.clear();
  cleanupState.deletedPaths.clear();
  cleanupState.lastClickedIdx = -1;
  const el = document.getElementById('cleanup-folder');
  if (el) {
    if (path) {
      el.textContent = path;
      el.title = path;
      el.classList.remove('empty');
    } else {
      el.textContent = 'No folder selected';
      el.title = '';
      el.classList.add('empty');
    }
  }
  document.getElementById('cleanup-results').hidden = true;
  document.getElementById('cleanup-empty').hidden = true;
  setCleanupError('');
  setCleanupStatus('');
  updateCleanupDeleteBtn();
}

async function chooseCleanupFolder() {
  if (cleanupState.busy) return;
  let chosen;
  try {
    chosen = await Neutralino.os.showFolderDialog('Select folder to clean');
  } catch (e) {
    console.error('showFolderDialog failed', e);
    return;
  }
  if (!chosen) return;
  const err = validateCleanupRoot(chosen);
  if (err) {
    setCleanupFolder('');
    setCleanupError(err);
    return;
  }
  setCleanupFolder(chosen);
  await runCleanupScan();
}

async function runCleanupScan() {
  if (!cleanupState.root || cleanupState.busy) return;
  const err = validateCleanupRoot(cleanupState.root);
  if (err) {
    setCleanupError(err);
    return;
  }
  setCleanupError('');
  setCleanupBusy(true);
  setCleanupStatus('Scanning…');
  try {
    const results = await runFindNodeModules(cleanupState.root);
    results.sort((a, b) => b.size - a.size);
    cleanupState.results = results;
    cleanupState.deletedPaths.clear();
    cleanupState.selected = new Set(results.map((r) => r.path));
    cleanupState.lastClickedIdx = -1;
    renderCleanupResults();
    setCleanupStatus(results.length === 0 ? 'No node_modules found.' : '');
  } catch (e) {
    console.error('cleanup scan failed', e);
    setCleanupError('Scan failed. Check folder permissions and try again.');
  } finally {
    setCleanupBusy(false);
  }
}

async function runCleanupDeleteFor(paths) {
  if (cleanupState.busy || !paths || paths.length === 0) return;
  const useRecycle = !!cleanupState.useRecycle;
  const verb = useRecycle ? 'Moved to Recycle Bin' : 'Deleted';
  const verbProg = useRecycle ? 'Recycling' : 'Deleting';
  setCleanupError('');
  setCleanupBusy(true);
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < paths.length; i += CLEANUP_DELETE_BATCH) {
    const batch = paths.slice(i, i + CLEANUP_DELETE_BATCH);
    setCleanupStatus(`${verbProg} ${Math.min(i + batch.length, paths.length)}/${paths.length}…`);
    try {
      const r = await runDeleteBatch(batch, useRecycle);
      for (const p of r.deleted) {
        cleanupState.deletedPaths.add(p);
        cleanupState.selected.delete(p);
      }
      deleted += r.deleted.length;
      failed += r.failed.length;
    } catch (e) {
      console.error('cleanup delete batch failed', e);
      failed += batch.length;
    }
    renderCleanupResults();
  }
  setCleanupBusy(false);
  if (failed > 0) {
    const hint = useRecycle ? ' Try with "Move to Recycle Bin" off (some items may be too large for the bin).' : '';
    setCleanupError(`${failed} folder${failed === 1 ? '' : 's'} could not be removed.${hint}`);
    setCleanupStatus(`${verb} ${deleted}, failed ${failed}.`);
  } else {
    setCleanupStatus(`${verb} ${deleted} folder${deleted === 1 ? '' : 's'}.`);
  }
}

async function runCleanupDelete() {
  await runCleanupDeleteFor(getSelectedCleanupPaths());
}

const TAB_LABELS = {
  processes: 'Node.js process monitor',
  cleanup: 'Find and remove node_modules',
};

function activateTab(name) {
  const tabs = document.querySelectorAll('.tab[data-tab]');
  tabs.forEach((t) => {
    const active = t.getAttribute('data-tab') === name;
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const procPanel = document.getElementById('tab-processes');
  const cleanPanel = document.getElementById('tab-cleanup');
  if (procPanel) procPanel.hidden = name !== 'processes';
  if (cleanPanel) cleanPanel.hidden = name !== 'cleanup';
  const sub = document.getElementById('header-subtitle');
  if (sub && TAB_LABELS[name]) sub.textContent = TAB_LABELS[name];
}

function wireTabs() {
  const tabs = document.querySelectorAll('.tab[data-tab]');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      const name = t.getAttribute('data-tab');
      if (name) activateTab(name);
    });
  });
  activateTab('processes');
}

function onCleanupListMouseDown(e) {
  // Suppress text selection on shift+click
  if (e.shiftKey && e.target && e.target.closest && e.target.closest('.cleanup-row')) {
    e.preventDefault();
  }
}

function onCleanupListClick(e) {
  if (cleanupState.busy) return;
  const target = /** @type {HTMLElement} */ (e.target);
  if (!target) return;

  // Per-row delete (×)
  const delBtn = target.closest('.cleanup-row-delete');
  if (delBtn && !delBtn.disabled) {
    e.preventDefault();
    e.stopPropagation();
    const path = delBtn.getAttribute('data-path');
    if (path && !cleanupState.deletedPaths.has(path)) {
      runCleanupDeleteFor([path]);
    }
    return;
  }

  const row = target.closest('.cleanup-row');
  if (!row) return;
  const path = row.getAttribute('data-path');
  const idx = parseInt(row.getAttribute('data-idx') || '-1', 10);
  if (!path || idx < 0 || cleanupState.deletedPaths.has(path)) return;

  e.preventDefault();

  if (e.shiftKey && cleanupState.lastClickedIdx >= 0 && cleanupState.lastClickedIdx !== idx) {
    const wasSelected = cleanupState.selected.has(path);
    setSelectionForRange(cleanupState.lastClickedIdx, idx, !wasSelected);
  } else {
    if (cleanupState.selected.has(path)) cleanupState.selected.delete(path);
    else cleanupState.selected.add(path);
  }
  cleanupState.lastClickedIdx = idx;
  renderCleanupResults();
}

function onCleanupSelectAll() {
  if (cleanupState.busy) return;
  const active = getActiveResults();
  if (active.length === 0) return;
  const allSelected = active.every((r) => cleanupState.selected.has(r.path));
  if (allSelected) {
    for (const r of active) cleanupState.selected.delete(r.path);
  } else {
    for (const r of active) cleanupState.selected.add(r.path);
  }
  renderCleanupResults();
}

function onCleanupRecycleToggle(e) {
  cleanupState.useRecycle = !!e.target.checked;
  updateCleanupDeleteBtn();
}

function wireCleanupTab() {
  const chooseBtn = document.getElementById('cleanup-choose');
  const rescanBtn = document.getElementById('cleanup-rescan');
  const deleteBtn = document.getElementById('cleanup-delete');
  const masterCb = document.getElementById('cleanup-select-all');
  const recycleCb = document.getElementById('cleanup-recycle');
  const list = document.getElementById('cleanup-list');

  if (chooseBtn) chooseBtn.addEventListener('click', chooseCleanupFolder);
  if (rescanBtn) rescanBtn.addEventListener('click', runCleanupScan);
  if (deleteBtn) deleteBtn.addEventListener('click', runCleanupDelete);
  if (masterCb) masterCb.addEventListener('change', onCleanupSelectAll);
  if (recycleCb) {
    cleanupState.useRecycle = !!recycleCb.checked;
    recycleCb.addEventListener('change', onCleanupRecycleToggle);
  }
  if (list) {
    list.addEventListener('mousedown', onCleanupListMouseDown);
    list.addEventListener('click', onCleanupListClick);
  }
  setCleanupFolder('');
}

function compareVersions(a, b) {
  const parse = s => String(s || '').split('.').map(n => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function showUpdateBanner(version, target, pending) {
  const banner = document.getElementById('update-banner');
  const versionEl = document.getElementById('update-version');
  const btn = document.getElementById('update-restart');
  if (!banner) return;
  versionEl.textContent = 'v' + version;
  banner.hidden = false;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Updating…';
    await applyUpdateAndRestart(target, pending);
  });
}

function buildApplyUpdateScript(target, pending) {
  const exePath = `${String(NL_PATH).replace(/[\\/]+$/, '')}\\NodeTasks.exe`;
  return `
$ErrorActionPreference = 'SilentlyContinue'
$target = '${target.replace(/'/g, "''")}'
$pending = '${pending.replace(/'/g, "''")}'
$exe = '${exePath.replace(/'/g, "''")}'
# Wait until we can open the live bundle for write — i.e. our parent has exited
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  try {
    $f = [System.IO.File]::Open($target, 'Open', 'ReadWrite', 'None')
    $f.Close()
    break
  } catch { Start-Sleep -Milliseconds 200 }
}
Start-Sleep -Milliseconds 200
Move-Item -Force -LiteralPath $pending -Destination $target
Start-Process -FilePath $exe
`.trim();
}

async function applyUpdateAndRestart(target, pending) {
  // cmd /c start /B detaches powershell from this process so it survives our exit.
  const encoded = encodePsCommand(buildApplyUpdateScript(target, pending));
  const cmd = `cmd /c start "" /B powershell -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}`;
  try { await Neutralino.os.spawnProcess(cmd); } catch (e) { console.warn('spawn swap failed', e); }
  try { await Neutralino.app.exit(); } catch {}
}

async function checkForUpdate() {
  const url = typeof NL_UPDATE_MANIFEST_URL === 'string' ? NL_UPDATE_MANIFEST_URL : '';
  if (!url || url.includes('CHANGE-ME')) return;

  let manifest;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return;
    manifest = await r.json();
  } catch (e) {
    console.warn('manifest fetch failed', e);
    return;
  }

  if (!manifest || typeof manifest.version !== 'string') return;
  if (manifest.applicationId && manifest.applicationId !== NL_APPID) return;
  if (compareVersions(manifest.version, NL_APPVERSION) <= 0) return;
  if (!manifest.resourcesURL) return;

  const target = `${String(NL_PATH).replace(/[\\/]+$/, '')}\\resources.neu`;
  const pending = target + '.new';

  // Download via PowerShell (WebView2 fetch can't follow GitHub Releases redirects:
  // the CDN final URL doesn't send Access-Control-Allow-Origin).
  const dlScript = `
    $ProgressPreference = 'SilentlyContinue'
    $ErrorActionPreference = 'Stop'
    try {
      Invoke-WebRequest -Uri '${manifest.resourcesURL.replace(/'/g, "''")}' -OutFile '${pending.replace(/'/g, "''")}' -UseBasicParsing
      'OK'
    } catch { 'FAIL' }
  `.trim();
  try {
    const r = await Neutralino.os.execCommand(psCommand(dlScript));
    if ((r.stdOut || '').trim() !== 'OK') {
      console.warn('resources download failed', r.stdErr || r.stdOut);
      return;
    }
    const stat = await Neutralino.filesystem.getStats(pending).catch(() => null);
    if (!stat || stat.size < 1024) return;
  } catch (e) {
    console.warn('resources download failed', e);
    return;
  }

  showUpdateBanner(manifest.version, target, pending);
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
  wireSettingsModal();
  wireTabs();
  wireCleanupTab();
  wireContextMenu();

  autostartEnabled = await readAutostartState();
  syncAutostartUi();
  setupTray();

  await detectCores();
  await poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  checkForUpdate();
}

start();
