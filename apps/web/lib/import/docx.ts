// Word(.docx) → 가벼운 마크다운. mammoth로 HTML을 만든 뒤 제목·문단·목록·인용만 옮긴다.
// 문서 안 그림은 서버에 올려 ![](주소)로 넣는다 (많으면 앞의 MAX_IMAGES장만).

import { uploadBlob } from "@/lib/upload";

const MAX_DOCX_BYTES = 30 * 1024 * 1024;
const MAX_IMAGES = 40;

export async function docxToMarkdown(file: File, onProgress?: (msg: string) => void): Promise<string> {
  if (file.size > MAX_DOCX_BYTES) throw new Error("Word 파일은 30MB까지 가져올 수 있어요.");
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const doc = new DOMParser().parseFromString(html, "text/html");

  const out: string[] = [];
  let images = 0;
  const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

  async function image(img: HTMLImageElement) {
    const src = img.getAttribute("src") ?? "";
    if (!src.startsWith("data:image/") || images >= MAX_IMAGES) return;
    images++;
    onProgress?.(`그림 올리는 중… (${images})`);
    try {
      const blob = await (await fetch(src)).blob();
      out.push(`![${img.getAttribute("alt") ?? ""}](${await uploadBlob(blob)})`, "");
    } catch {
      // 올리지 못한 그림은 건너뛴다
    }
  }

  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    for (const img of Array.from(el.querySelectorAll("img"))) await image(img as HTMLImageElement);
    const t = text(el);
    if (tag === "h1") out.push(`# ${t}`, "");
    else if (/^h[2-6]$/.test(tag)) out.push(`## ${t}`, "");
    else if (tag === "ul" || tag === "ol") {
      Array.from(el.querySelectorAll(":scope > li")).forEach((li, i) => out.push(`${tag === "ol" ? `${i + 1}.` : "-"} ${text(li)}`));
      out.push("");
    } else if (tag === "blockquote") out.push(`> ${t}`, "");
    else if (tag === "table") {
      for (const tr of Array.from(el.querySelectorAll("tr"))) out.push(Array.from(tr.children).map(text).join(" | "));
      out.push("");
    } else if (t) out.push(t, "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
