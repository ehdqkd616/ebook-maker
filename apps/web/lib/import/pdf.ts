// 브라우저에서 PDF 읽기 (pdf.js). 파일은 서버로 보내지 않고, 필요한 결과(쪽 이미지·글)만 만든다.
//  - 쪽 그대로: 각 쪽을 canvas에 그려 JPEG로 → 업로드 → 플립북 페이지 배경
//  - 글만: 텍스트를 줄·문단으로 묶고, 본문보다 큰 글자 줄은 제목(# / ##)으로 본다

// legacy 빌드: 최신 pdf.js는 아주 새로운 JS 기능(Map.getOrInsertComputed 등)을 써서 조금 오래된 브라우저에서
// 멈춘다. legacy 빌드는 이를 폴리필로 채워 넣어 준다.
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_PDF_PAGES = 200;

async function pdfjs() {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return lib;
}

export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const { getDocument } = await pdfjs();
  try {
    return await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new Error("암호가 걸린 PDF는 가져올 수 없어요.");
    throw new Error("PDF를 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.");
  }
}

/** 첫 쪽 크기(pt) — 책 비율을 정하는 데 쓴다 */
export async function firstPageSize(doc: PDFDocumentProxy) {
  const page = await doc.getPage(1);
  const { width, height } = page.getViewport({ scale: 1 });
  return { width, height };
}

/**
 * 각 쪽을 targetWidth(px) 폭의 JPEG로 그려 하나씩 넘긴다.
 * 그리기는 한 쪽씩(메모리), 업로드는 onPage에서 비동기로 해도 된다.
 */
export async function renderPdfPages(
  doc: PDFDocumentProxy,
  targetWidth: number,
  onPage: (blob: Blob, index: number) => Promise<void>,
  shouldStop: () => boolean = () => false,
) {
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let i = 1; i <= total; i++) {
    if (shouldStop()) return;
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, targetWidth / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // 투명 배경 PDF도 흰 종이로
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    page.cleanup();
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error(`${i}쪽을 그리지 못했어요.`);
    await onPage(blob, i - 1);
  }
}

type Line = { text: string; size: number; y: number; page: number };

/** PDF 글 → 가벼운 마크다운 (빈 줄 = 문단, # 챕터, ## 소제목). 쪽 번호만 있는 줄은 버린다 */
export async function pdfToMarkdown(doc: PDFDocumentProxy): Promise<string> {
  const lines: Line[] = [];
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let cur: Line | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const size = Math.hypot(item.transform[2], item.transform[3]) || item.height;
      const y = item.transform[5];
      if (cur && Math.abs(cur.y - y) > size * 0.5) {
        lines.push(cur);
        cur = null;
      }
      if (item.str) {
        if (!cur) cur = { text: item.str, size, y, page: p };
        else {
          cur.text += item.str;
          cur.size = Math.max(cur.size, size);
        }
      }
      if (item.hasEOL && cur) {
        lines.push(cur);
        cur = null;
      }
    }
    if (cur) lines.push(cur);
    page.cleanup();
  }

  const clean = lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text && !/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l.text));
  if (clean.length === 0) return "";

  // 글자 수로 가중한 가장 흔한 크기 = 본문 크기
  const weight = new Map<number, number>();
  for (const l of clean) weight.set(Math.round(l.size), (weight.get(Math.round(l.size)) ?? 0) + l.text.length);
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const out: string[] = [];
  let para = "";
  let prev: Line | null = null;
  const flush = () => {
    if (para) out.push(para, "");
    para = "";
  };
  for (const l of clean) {
    const isHeading = l.text.length <= 60 && l.size >= body * 1.3;
    if (isHeading) {
      flush();
      out.push(`${l.size >= body * 1.6 ? "#" : "##"} ${l.text}`, "");
      prev = null;
      continue;
    }
    // 줄 간격이 평소보다 크거나 쪽이 바뀌면서 앞 줄이 문장으로 끝났으면 새 문단
    const gap = prev && prev.page === l.page ? Math.abs(prev.y - l.y) : 0;
    const newPara = !prev || gap > l.size * 1.9 || (prev.page !== l.page && /[.!?。"”’)]$/.test(para));
    if (newPara) flush();
    para = para ? `${para}${/[-‐]$/.test(para) ? "" : " "}${l.text}` : l.text;
    prev = l;
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
