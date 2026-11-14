// OCR for scanned statements and photos. Runs entirely in the browser with
// Tesseract (WebAssembly); engine and language data are served from
// /vendor/ocr — the document never leaves the device.
import { linesFromText } from './lines';
import { Line } from './types';

export type OcrImage = HTMLCanvasElement | Blob;

export async function ocrImages(
  images: OcrImage[],
  onProgress?: (fraction: number) => void,
): Promise<Line[]> {
  const { createWorker, PSM } = await import('tesseract.js');
  let done = 0;
  const worker = await createWorker('eng', 1, {
    workerPath: '/vendor/ocr/worker.min.js',
    corePath: '/vendor/ocr/core',
    langPath: '/vendor/ocr/lang',
    workerBlobURL: false,
    gzip: true,
    logger: m => {
      if (m.status === 'recognizing text') onProgress?.((done + m.progress) / images.length);
    },
  });
  try {
    await worker.setParameters({
      // Keep each printed row as one line (a multi-column layout guess would
      // separate the descriptions from their amounts).
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });
    const lines: Line[] = [];
    for (const [i, image] of images.entries()) {
      const { data } = await worker.recognize(image);
      lines.push(...linesFromText(data.text, i + 1));
      done = i + 1;
      onProgress?.(done / images.length);
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}
