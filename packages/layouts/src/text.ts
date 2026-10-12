import type { Block, Book, Page, TocEntry } from "@ebook/schema";

// 뷰어 검색·목차, 공개 페이지 SEO 글에 쓰는 도우미

function blockText(b: Block): string {
  switch (b.type) {
    case "heading":
    case "paragraph":
    case "link":
      return b.data.text;
    case "quote":
      return [b.data.text, b.data.cite].filter(Boolean).join(" ");
    case "list":
      return b.data.items.join(" ");
    case "toc":
      return b.data.entries.map((e) => e.title).join(" ");
    case "product":
      return [b.data.name, b.data.price, b.data.description].filter(Boolean).join(" ");
    case "button":
      return b.data.text;
    case "audio":
      return b.data.title ?? "";
    case "slideshow":
      return b.data.images.map((i) => i.caption ?? "").join(" ");
    case "image":
      return b.data.alt;
    default:
      return "";
  }
}

/** 한 쪽의 글 전체 (블록 글 + PDF에서 가져온 글) */
export function pageText(page: Page): string {
  return [...page.blocks.filter((b) => !b.hidden).map(blockText), page.searchText ?? ""]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 뷰어 목차: 직접 정한 목차(PDF 책갈피 등) → 없으면 챕터 시작 페이지 */
export function bookToc(book: Book): TocEntry[] {
  if (book.toc?.length) return book.toc;
  return book.pages.flatMap((p, i) => {
    if (p.layoutId !== "chapter-opener") return [];
    const t = p.blocks.find((b) => b.slot === "title" && b.type === "heading");
    return t?.type === "heading" ? [{ title: t.data.text.replace(/\s*\n\s*/g, " "), page: i + 1, level: 1 }] : [];
  });
}

export type SearchHit = { page: number; snippet: string; start: number; length: number };

/** 대소문자·공백 차이를 무시하고 찾는다. 쪽마다 처음 3군데까지 */
export function searchBook(book: Book, query: string, perPage = 3): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const hits: SearchHit[] = [];
  book.pages.forEach((p, i) => {
    const text = pageText(p);
    const lower = text.toLowerCase();
    let from = 0;
    for (let n = 0; n < perPage; n++) {
      const at = lower.indexOf(q, from);
      if (at < 0) break;
      const s = Math.max(0, at - 30);
      const e = Math.min(text.length, at + q.length + 50);
      hits.push({ page: i + 1, snippet: `${s > 0 ? "…" : ""}${text.slice(s, e)}${e < text.length ? "…" : ""}`, start: at - s + (s > 0 ? 1 : 0), length: q.length });
      from = at + q.length;
    }
  });
  return hits;
}
