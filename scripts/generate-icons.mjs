import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="48" ry="48" fill="#4da6ff"/>
  <rect x="64" y="64" width="32" height="128" fill="#04121f"/>
  <rect x="160" y="64" width="32" height="128" fill="#04121f"/>
  <polygon fill="#04121f" points="64,64 96,64 192,192 160,192"/>
</svg>
`;

async function writePng(size, outPath) {
  const buf = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
  console.log(`wrote ${path.relative(ROOT, outPath)} (${size}x${size})`);
}

async function writeIco(sizes, outPath) {
  const pngs = await Promise.all(
    sizes.map((s) =>
      sharp(Buffer.from(SVG)).resize(s, s).png().toBuffer()
    )
  );
  const ico = await pngToIco(pngs);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, ico);
  console.log(`wrote ${path.relative(ROOT, outPath)} (ico: ${sizes.join(",")})`);
}

const desktopIcons = path.join(ROOT, "apps/desktop/resources/icons");
const webPublic = path.join(ROOT, "apps/web/public");

await writePng(256, path.join(desktopIcons, "appIcon.png"));
await writePng(32, path.join(desktopIcons, "trayIcon.png"));
await writeIco([16, 32, 48, 64, 128, 256], path.join(desktopIcons, "icon.ico"));

await writePng(192, path.join(webPublic, "icon-192.png"));
await writePng(512, path.join(webPublic, "icon-512.png"));
await writeIco([16, 32, 48], path.join(webPublic, "favicon.ico"));

const webApp = path.join(ROOT, "apps/web/app");
await writePng(180, path.join(webApp, "apple-icon.png"));
await writeIco([16, 32, 48], path.join(webApp, "favicon.ico"));

await fs.writeFile(path.join(ROOT, "assets/brand-mark.svg"), SVG).catch(async () => {
  await fs.mkdir(path.join(ROOT, "assets"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "assets/brand-mark.svg"), SVG);
});

console.log("done.");
