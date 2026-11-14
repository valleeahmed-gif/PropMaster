// PDF text layer → Lines, using pdf.js (loaded on demand, self-hosted worker).
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Fragment, linesFromFragments } from './lines';
import { Line } from './types';

/** The PDF is encrypted and needs (another) password. */
export class PdfPasswordError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? 'Incorrect PDF password' : 'This PDF is password protected');
    this.name = 'PdfPasswordError';
  }
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  pdfjsPromise ??= import('pdfjs-dist').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  return pdfjsPromise;
}

export interface OpenPdf {
  doc: PDFDocumentProxy;
  /** Release the document and its worker memory. */
  close: () => void;
}

export async function openPdf(data: ArrayBuffer, password?: string): Promise<OpenPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data.slice(0)),
    password,
    wasmUrl: '/vendor/pdfjs/wasm/',
  });
  try {
    const doc = await task.promise;
    return { doc, close: () => { void task.destroy().catch(() => {}); } };
  } catch (err) {
    void task.destroy().catch(() => {});
    const e = err as { name?: string; code?: number };
    if (e?.name === 'PasswordException') throw new PdfPasswordError(e.code === 2);
    throw new Error('This file could not be opened as a PDF. It may be damaged.');
  }
}

/** Text of the first `maxPages` pages as positioned lines. */
export async function pdfTextLines(doc: PDFDocumentProxy, maxPages = 10): Promise<Line[]> {
  const pdfjs = await loadPdfjs();
  const lines: Line[] = [];
  const pages = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const fragments: Fragment[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      // Map to upright page coordinates so rotated pages read correctly.
      const t = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(t[2], t[3]) || item.height || 8;
      fragments.push({ str: item.str, x: t[4], y: -t[5], width: item.width, height });
    }
    lines.push(...linesFromFragments(fragments, p));
    page.cleanup();
  }
  return lines;
}

/** Render a page to a canvas for OCR (scale 2 ≈ 144 dpi, enough for statements). */
export async function renderPdfPage(doc: PDFDocumentProxy, pageNumber: number, scale = 2.2): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  // Cap the bitmap so a huge page cannot exhaust memory on a phone.
  const maxSide = 2600;
  const s = Math.min(scale, maxSide / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: s });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}
