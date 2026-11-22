import * as pdfjsLib from 'pdfjs-dist';
import { PdfPageTextInput } from './questionBankEngine';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback gracefully if worker URL resolution fails in non-standard bundlers
  }
}

export async function extractPdfPagesFromArrayBuffer(
  buffer: ArrayBuffer
): Promise<{ pages: PdfPageTextInput[]; totalPages: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pages: PdfPageTextInput[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const linesMap = new Map<number, string[]>();

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = String(item.str || '');
      if (!str.trim()) continue;
      const yBucket = Math.round((item.transform?.[5] ?? 0) / 4) * 4;
      const bucket = linesMap.get(yBucket) || [];
      bucket.push(str);
      linesMap.set(yBucket, bucket);
    }

    const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const pageText = sortedYs
      .map((y) => (linesMap.get(y) || []).join(' ').trim())
      .filter(Boolean)
      .join('\n');

    pages.push({
      pageNumber: p,
      text: pageText,
      isImageOnly: pageText.replace(/\s+/g, '').length < 15,
    });
  }

  return { pages, totalPages };
}
