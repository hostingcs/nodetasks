import * as ResEdit from "resedit";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const EXE = path.join(ROOT, "apps/desktop/dist/NodeTasks/NodeTasks-win_x64.exe");
const ICO = path.join(ROOT, "apps/desktop/resources/icons/icon.ico");

const version = process.env.VERSION || "1.0.0";
const [maj = 1, min = 0, patch = 0, build = 0] = version
  .split(".")
  .map((n) => parseInt(n, 10) || 0);

const exeBuf = await fs.readFile(EXE);
const icoBuf = await fs.readFile(ICO);

const exe = ResEdit.NtExecutable.from(exeBuf);
const res = ResEdit.NtExecutableResource.from(exe);

const iconFile = ResEdit.Data.IconFile.from(icoBuf);

ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  1,
  1033,
  iconFile.icons.map((item) => item.data)
);

const vi = ResEdit.Resource.VersionInfo.createEmpty();
vi.setFileVersion(maj, min, patch, build);
vi.setProductVersion(maj, min, patch, build);
vi.setStringValues(
  { lang: 1033, codepage: 1200 },
  {
    CompanyName: "hostingcs",
    FileDescription: "NodeTasks",
    ProductName: "NodeTasks",
    LegalCopyright: "\u00a9 2026 hostingcs",
    OriginalFilename: "NodeTasks.exe",
    InternalName: "NodeTasks",
  }
);
vi.outputToResourceEntries(res.entries);

res.outputResource(exe);

const outBuf = Buffer.from(exe.generate());
await fs.writeFile(EXE, outBuf);

console.log(`Embedded icon + version ${version} into ${path.relative(ROOT, EXE)}`);
