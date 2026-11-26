import { parseReceipt } from "./receipt.js";

// Downscale big phone screenshots / photos; OCR reads 450-1200px wide images fine and it is faster.
async function toCanvas(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn’t open that image. Use a PNG or JPG screenshot.");
  }
  const scale = Math.min(1, 1200 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

/** Runs OCR fully in the browser (Tesseract.js). The image never leaves the phone. */
export async function scanReceipt(file, onProgress) {
  const canvas = await toCanvas(file);
  // Loaded on demand so the OCR engine is not part of the main bundle.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const lines = (data.blocks || [])
      .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
      .map((l) => ({ text: l.text, height: l.bbox.y1 - l.bbox.y0 }));
    return parseReceipt({ text: data.text, lines });
  } finally {
    await worker.terminate();
  }
}
