import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const require=createRequire(import.meta.url);
copyFileSync(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),join(process.cwd(),"public/pdf.worker.mjs"));
