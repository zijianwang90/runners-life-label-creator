import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const png2icons = require("png2icons");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "build", "icon-source.svg");
const logoPath = path.join(projectRoot, "logo.svg");
const buildDir = path.join(projectRoot, "build");
const sizeDir = path.join(buildDir, "icons");
const publicDir = path.join(projectRoot, "public");
const publicIconDir = path.join(publicDir, "icons");

await Promise.all([fs.mkdir(sizeDir, { recursive: true }), fs.mkdir(publicIconDir, { recursive: true })]);

const [template, logo] = await Promise.all([fs.readFile(sourcePath, "utf8"), fs.readFile(logoPath)]);
const logoDataUrl = `data:image/svg+xml;base64,${logo.toString("base64")}`;
const standaloneSvg = template
  .replaceAll('href="../../logo.svg"', `href="${logoDataUrl}"`)
  .replaceAll('xlink:href="../../logo.svg"', `xlink:href="${logoDataUrl}"`);
await fs.writeFile(path.join(publicDir, "app-icon.svg"), standaloneSvg, "utf8");

const masterPng = await sharp(Buffer.from(standaloneSvg)).resize(1024, 1024, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
await fs.writeFile(path.join(buildDir, "icon.png"), masterPng);

const sizes = [16, 24, 32, 48, 64, 72, 96, 128, 180, 192, 256, 512, 1024];
const generated = new Map();
for (const size of sizes) {
  const png = size === 1024
    ? masterPng
    : await sharp(masterPng).resize(size, size, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toBuffer();
  generated.set(size, png);
  await fs.writeFile(path.join(sizeDir, `${size}x${size}.png`), png);
}

const ico = png2icons.createICO(masterPng, png2icons.BICUBIC2, 0, false, true);
const icns = png2icons.createICNS(masterPng, png2icons.BICUBIC2, 0);
if (!ico || !icns) throw new Error("Could not generate ICO/ICNS application icons.");
await Promise.all([
  fs.writeFile(path.join(buildDir, "icon.ico"), ico),
  fs.writeFile(path.join(buildDir, "icon.icns"), icns),
  fs.writeFile(path.join(publicDir, "favicon.ico"), ico),
  fs.writeFile(path.join(publicDir, "favicon-16x16.png"), generated.get(16)),
  fs.writeFile(path.join(publicDir, "favicon-32x32.png"), generated.get(32)),
  fs.writeFile(path.join(publicDir, "apple-touch-icon.png"), generated.get(180)),
  fs.writeFile(path.join(publicIconDir, "app-icon-192.png"), generated.get(192)),
  fs.writeFile(path.join(publicIconDir, "app-icon-512.png"), generated.get(512))
]);

console.log("Generated Runners Life icons: SVG, PNG sizes, ICO, ICNS, favicon and touch icons.");
