import { jsPDF } from "jspdf";

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (url.startsWith("data:image/svg+xml")) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("SVG load failed"));
      img.src = url;
    });
  }

  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Blob read failed"));
    reader.readAsDataURL(blob);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image element load failed"));
    img.src = dataUrl;
  });
}

function imageToPngDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width || 800;
  canvas.height = img.naturalHeight || img.height || 1000;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }
  return img.src;
}

/** Export one or more handwritten page images into a single A4 PDF. */
export async function downloadHandwrittenPdf(urls: string[], fileName = "topper-ai-notes.pdf") {
  if (!urls.length) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 24;

  for (let i = 0; i < urls.length; i++) {
    try {
      const img = await loadImage(urls[i]);
      const pngDataUrl = imageToPngDataUrl(img);
      const maxW = pw - margin * 2;
      const maxH = ph - margin * 2;
      const scale = Math.min(maxW / (img.naturalWidth || 800), maxH / (img.naturalHeight || 1000));
      const w = (img.naturalWidth || 800) * scale;
      const h = (img.naturalHeight || 1000) * scale;

      if (i > 0) doc.addPage();
      doc.addImage(pngDataUrl, "PNG", (pw - w) / 2, (ph - h) / 2, w, h, undefined, "FAST");
    } catch (e) {
      console.warn("[downloadHandwrittenPdf] Image load error:", e);
    }
  }

  await saveOrSharePdf(doc, fileName);
}

/** Export any Topper AI text answer into a clean NCERT PDF file. */
export async function exportTextSolutionToPdf(title: string, markdownContent: string, fileName = "topper-ai-solution.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header Banner
  doc.setFillColor(30, 58, 138); // Indigo 900
  doc.rect(0, 0, pw, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LAST TOPPER · NCERT AI TUTOR", margin, 38);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("en-IN"), pw - margin - 80, 38);

  let y = 90;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const cleanTitle = title.replace(/[*#`$]/g, "").slice(0, 80);
  doc.text(cleanTitle, margin, y);
  y += 24;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, y, pw - margin, y);
  y += 20;

  // Content
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const cleanText = markdownContent
    .replace(/[*#`$]/g, "")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\rightarrow/g, "→");

  const lines = doc.splitTextToSize(cleanText, pw - margin * 2);

  for (const line of lines) {
    if (y > ph - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  await saveOrSharePdf(doc, fileName);
}

async function saveOrSharePdf(doc: jsPDF, fileName: string) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const base64 = doc.output("datauristring").split(",")[1];
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: "Topper AI NCERT Notes",
        text: fileName,
        url: written.uri,
        dialogTitle: "Save or Share Notes",
      });
      return;
    }
  } catch {
    /* browser fallback */
  }

  doc.save(fileName);
}
