// Copies the self-hosted runtime files for the statement reader into
// public/vendor/ (git-ignored). Nothing is loaded from a CDN at runtime:
//   ocr/    — Tesseract worker, WASM engine and English language data
//   pdfjs/  — pdf.js image decoders (JBIG2 / JPEG 2000) used by scanned PDFs
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);
const out = join(root, 'public', 'vendor');

const files = [
  [nm('tesseract.js', 'dist', 'worker.min.js'), 'ocr/worker.min.js'],
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), 'ocr/core/tesseract-core-lstm.wasm.js'],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), 'ocr/core/tesseract-core-simd-lstm.wasm.js'],
  [nm('tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  [nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), 'ocr/lang/eng.traineddata.gz'],
  [nm('pdfjs-dist', 'wasm', 'jbig2.wasm'), 'pdfjs/wasm/jbig2.wasm'],
  [nm('pdfjs-dist', 'wasm', 'openjpeg.wasm'), 'pdfjs/wasm/openjpeg.wasm'],
  [nm('pdfjs-dist', 'wasm', 'qcms_bg.wasm'), 'pdfjs/wasm/qcms_bg.wasm'],
];

rmSync(out, { recursive: true, force: true });
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`copy-statement-assets: missing ${from} — run npm ci`);
    process.exit(1);
  }
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(from, dest);
}
console.log(`copy-statement-assets: ${files.length} files → public/vendor/`);
