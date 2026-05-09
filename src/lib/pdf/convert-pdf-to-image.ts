type PdfJsLegacyModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsLegacy: PdfJsLegacyModule | null = null;
let workerSrcSet = false;

async function getPdfJsLegacy(): Promise<PdfJsLegacyModule> {
  if (pdfjsLegacy) return pdfjsLegacy;
  pdfjsLegacy = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsLegacy;
}

function ensurePdfWorker(pdfjs: PdfJsLegacyModule): void {
  if (workerSrcSet || typeof window === "undefined") return;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  workerSrcSet = true;
}

const MAX_RENDER_EDGE = 2400;

/**
 * Renderiza a primeira página do PDF em um canvas (fora da árvore visível) e
 * devolve um data URL JPEG (qualidade 0.8), como pedido para envio à API de visão.
 */
export async function convertPdfToImage(file: File): Promise<string> {
  const pdfjs = await getPdfJsLegacy();
  ensurePdfWorker(pdfjs);

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    // Mantém worker, mas evita alguns caminhos de otimização menos estáveis em builds modernos.
    isOffscreenCanvasSupported: false,
    useWasm: false,
  });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_RENDER_EDGE / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;width:0;height:0";

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível obter o contexto 2D do canvas.");
    }

    const task = page.render({ canvas, canvasContext: ctx, viewport });
    await task.promise;
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    await pdf.destroy();
  }
}

/** Converte o resultado de `convertPdfToImage` em `File` JPEG para `FormData`. */
export function jpegDataUrlToFile(dataUrl: string, filename: string): File {
  const head = "data:image/";
  if (!dataUrl.startsWith(head) || !dataUrl.includes(";base64,")) {
    throw new Error("Data URL JPEG inválida.");
  }
  const semi = dataUrl.indexOf(";");
  const mime = dataUrl.slice(5, semi);
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}
