// Built-in statement reader: PDF or image in, charge lines out.
// Everything runs in the browser — no AI service, no upload.
import { parseStatement } from './parse';
import { openPdf, pdfTextLines, renderPdfPage } from './pdf';
import { Line, ParsedStatement } from './types';

export type { ParsedItem, ParsedStatement, ChargeCategory } from './types';
export { PdfPasswordError } from './pdf';
export { parseStatement } from './parse';
export { linesFromText } from './lines';

export const MAX_STATEMENT_BYTES = 15 * 1024 * 1024;
const MAX_OCR_PAGES = 4;

export interface ReadProgress {
  stage: 'opening' | 'reading' | 'ocr';
  /** 0–1 during OCR. */
  fraction?: number;
}

export interface ReadOptions {
  password?: string;
  onProgress?: (p: ReadProgress) => void;
}

export const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
export const isImage = (file: File) => /^image\/(png|jpe?g|webp|bmp)$/i.test(file.type) || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

/** Enough real text to trust the PDF's own text layer. */
function hasUsefulText(lines: Line[]): boolean {
  const letters = lines.reduce((n, l) => n + l.text.replace(/[^a-z]/gi, '').length, 0);
  return lines.length >= 5 && letters >= 80;
}

/**
 * Read a statement file. Digital PDFs are read from their text layer; scans
 * and photos fall back to on-device OCR.
 * @throws PdfPasswordError when the PDF needs a password.
 */
export async function readStatement(file: File, opts: ReadOptions = {}): Promise<ParsedStatement> {
  const { onProgress } = opts;
  if (file.size > MAX_STATEMENT_BYTES) throw new Error('That file is larger than 15 MB. Try a smaller export of the statement.');

  if (isImage(file)) {
    onProgress?.({ stage: 'ocr', fraction: 0 });
    const { ocrImages } = await import('./ocr');
    const lines = await ocrImages([file], f => onProgress?.({ stage: 'ocr', fraction: f }));
    return parseStatement(lines, 'ocr');
  }
  if (!isPdf(file)) throw new Error('Please upload a PDF, or a photo (JPG / PNG) of the statement.');

  onProgress?.({ stage: 'opening' });
  const { doc, close } = await openPdf(await file.arrayBuffer(), opts.password);
  try {
    onProgress?.({ stage: 'reading' });
    const lines = await pdfTextLines(doc);
    if (hasUsefulText(lines)) {
      const parsed = parseStatement(lines, 'text');
      if (parsed.items.length > 0) return parsed;
    }
    // No (usable) text layer: the PDF is a scan. Read the page images instead.
    onProgress?.({ stage: 'ocr', fraction: 0 });
    const pages = Math.min(doc.numPages, MAX_OCR_PAGES);
    const canvases: HTMLCanvasElement[] = [];
    for (let p = 1; p <= pages; p++) canvases.push(await renderPdfPage(doc, p));
    const { ocrImages } = await import('./ocr');
    const ocrLines = await ocrImages(canvases, f => onProgress?.({ stage: 'ocr', fraction: f }));
    const parsed = parseStatement(ocrLines, 'ocr');
    if (parsed.items.length === 0 && hasUsefulText(lines)) return parseStatement(lines, 'text');
    return parsed;
  } finally {
    close();
  }
}
