// EPUB 3 (고정 레이아웃) 내보내기 — 브라우저에서 만든다.
// 쪽마다 PageRenderer를 정적 HTML로 그려 XHTML로 바꾸고, 쓰인 그림을 함께 묶어 .epub(zip)으로 내려 준다.
// 쪽 디자인을 그대로 유지하는 "고정 레이아웃"이라 Apple Books·Kobo·리디 등 고정 레이아웃을 지원하는 뷰어에서 연다.
// 동영상·폼 같은 인터랙티브 요소는 그림(버튼 모양)으로만 남는다.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bookToc, showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";
import { zip, type ZipEntry } from "./zip";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enc = new TextEncoder();

/** 문서에 올라온 스타일 중 쪽 그리기에 쓰는 규칙(.eb-…, @keyframes eb-…)만 모은다 */
function rendererCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // 다른 출처 스타일
    }
    const walk = (list: CSSRuleList) => {
      for (const r of Array.from(list)) {
        if (r instanceof CSSStyleRule && /\.eb-/.test(r.selectorText) && !/eb-anim-ready|eb-page-active|eb-interactive:hover/.test(r.selectorText)) out.push(r.cssText);
        else if (r instanceof CSSKeyframesRule && r.name.startsWith("eb-")) out.push(r.cssText);
        else if ((r instanceof CSSMediaRule || r instanceof CSSSupportsRule || ("cssRules" in r && r.constructor.name === "CSSLayerBlockRule")) && "cssRules" in r) walk((r as CSSGroupingRule).cssRules);
      }
    };
    walk(rules);
  }
  return out.join("\n");
}

const extOf = (mime: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" })[mime];

export async function buildEpub(book: Book, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const { width: W, height: H } = book.size;
  const images = new Map<string, { path: string; mime: string; data: Uint8Array } | null>(); // 원래 주소 → 묶은 파일
  let imgSeq = 0;
  const fetchImage = async (url: string) => {
    if (images.has(url)) return images.get(url)!;
    let item: { path: string; mime: string; data: Uint8Array } | null = null;
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = extOf(mime);
      if (res.ok && ext) item = { path: `img/i${++imgSeq}.${ext}`, mime, data: new Uint8Array(await res.arrayBuffer()) };
    } catch {
      /* 못 받은 그림(다른 사이트 등)은 빼고 만든다 */
    }
    images.set(url, item);
    return item;
  };

  const pages: { name: string; xhtml: string }[] = [];
  for (const [i, page] of book.pages.entries()) {
    onProgress?.(i, book.pages.length);
    const html = renderToStaticMarkup(
      createElement(PageRenderer, {
        page,
        theme: book.theme,
        size: book.size,
        isStatic: true,
        pageNumber: showsPageNumber(page.layoutId) ? i + 1 : undefined,
      }),
    );
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
    // 인터랙티브 요소 정리: iframe·video·audio는 뺀다
    doc.querySelectorAll("iframe, video, audio, script").forEach((el) => el.remove());
    // 그림: <img src>와 배경 url(…)을 묶은 파일로 바꾼다
    for (const img of Array.from(doc.querySelectorAll("img"))) {
      const src = img.getAttribute("src") ?? "";
      const got = src ? await fetchImage(src) : null;
      if (got) img.setAttribute("src", got.path);
      else img.remove();
    }
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[style*='url(']"))) {
      const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(el.style.backgroundImage || "");
      if (!m) continue;
      const got = await fetchImage(m[1]);
      el.style.backgroundImage = got ? `url("${got.path}")` : "none";
    }
    const body = Array.from(doc.body.childNodes).map((n) => new XMLSerializer().serializeToString(n)).join("");
    pages.push({
      name: `p${String(i + 1).padStart(4, "0")}.xhtml`,
      xhtml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="http://www.idpf.org/2007/ops" lang="${esc(book.language || "ko")}" xml:lang="${esc(book.language || "ko")}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=${W}, height=${H}"/><title>${esc(book.title)} · ${i + 1}</title><link rel="stylesheet" href="style.css"/></head>
<body>${body.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "")}</body>
</html>`,
    });
  }
  onProgress?.(book.pages.length, book.pages.length);

  const css = `@page { margin: 0; }
html, body { margin: 0; padding: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
${rendererCss()}`;

  const toc = bookToc(book);
  const tocItems = (toc.length ? toc : [{ title: book.title, page: 1, level: 1 }])
    .filter((e) => e.page >= 1 && e.page <= pages.length)
    .map((e) => `<li><a href="${pages[e.page - 1].name}">${esc(e.title)}</a></li>`)
    .join("\n");
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="UTF-8"/><title>목차</title></head>
<body><nav epub:type="toc" id="toc"><h1>목차</h1><ol>
${tocItems}
</ol></nav></body></html>`;

  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const imgList = [...images.values()].filter((x): x is NonNullable<typeof x> => !!x);
  const coverUrl = book.pages[0]?.background?.imageUrl;
  const coverPath = coverUrl ? images.get(coverUrl)?.path : undefined;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${esc(book.title)}</dc:title>
    <dc:language>${esc(book.language || "ko")}</dc:language>
    ${book.author ? `<dc:creator>${esc(book.author)}</dc:creator>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">auto</meta>
    <meta property="rendition:spread">${W > H ? "none" : "landscape"}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
${pages.map((p, i) => `    <item id="p${i + 1}" href="${p.name}" media-type="application/xhtml+xml"/>`).join("\n")}
${imgList.map((im, k) => `    <item id="img${k + 1}" href="${im.path}" media-type="${im.mime}"${im.path === coverPath ? ' properties="cover-image"' : ""}/>`).join("\n")}
  </manifest>
  <spine>
${pages.map((_, i) => `    <itemref idref="p${i + 1}"${i === 0 ? ' properties="rendition:page-spread-center"' : ""}/>`).join("\n")}
  </spine>
</package>`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  const entries: ZipEntry[] = [
    { name: "mimetype", data: enc.encode("application/epub+zip") }, // 맨 앞, 압축 없이 (EPUB 규칙)
    { name: "META-INF/container.xml", data: enc.encode(container) },
    { name: "OEBPS/content.opf", data: enc.encode(opf) },
    { name: "OEBPS/nav.xhtml", data: enc.encode(nav) },
    { name: "OEBPS/style.css", data: enc.encode(css) },
    ...pages.map((p) => ({ name: `OEBPS/${p.name}`, data: enc.encode(p.xhtml) })),
    ...imgList.map((im) => ({ name: `OEBPS/${im.path}`, data: im.data })),
  ];
  return new Blob([zip(entries) as BlobPart], { type: "application/epub+zip" });
}

/** 만든 EPUB을 파일로 내려받게 한다 */
export async function downloadEpub(book: Book, onProgress?: (done: number, total: number) => void) {
  const blob = await buildEpub(book, onProgress);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(book.title || "ebook").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "ebook"}.epub`;
  document.body.appendChild(a);
  a.click();
  // 바로 지우면 일부 브라우저가 파일 이름(download 속성)을 잃는다
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(a.href);
  }, 10_000);
}
