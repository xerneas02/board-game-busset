import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { seedAssets } from "../data/seed-assets";
import cachedCovers from "../data/cached-covers.json";

const directory = join(process.cwd(), "public", "covers");
const manifest: Record<string, string> = { ...cachedCovers };
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

async function main() {
await mkdir(directory, { recursive: true });
for (const [name, asset] of Object.entries(seedAssets)) {
  if (!asset.cover) continue;
  try {
    const response = await fetch(asset.cover, { headers: { "User-Agent": "SousLescalier/1.0 (family board-game library)" }, signal: AbortSignal.timeout(20000) });
    const type = response.headers.get("content-type")?.split(";")[0].trim() || "";
    const extension = extensions[type];
    if (!response.ok || !extension) throw new Error(`HTTP ${response.status}, ${type}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error("image > 8 Mo");
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${slug}.${extension}`;
    await writeFile(join(directory, filename), bytes);
    manifest[name] = `/covers/${filename}`;
    console.log(`${name}: ${filename}`);
  } catch (error) {
    console.warn(`${name}: ${error instanceof Error ? error.message : error}`);
  }
}
await writeFile(join(process.cwd(), "data", "cached-covers.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`${Object.keys(manifest).length} couvertures locales`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
