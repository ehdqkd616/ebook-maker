import { describe, expect, it } from "vitest";
import { Book, LAYOUT_IDS, SIZE_PRESETS } from "@ebook/schema";
import {
  applyLayout,
  composeBook,
  composeImageBook,
  countLines,
  createPage,
  flowUnits,
  getThemePreset,
  moveOverflowToNextPage,
  overflowingBlocks,
  parseBody,
  searchBook,
  refreshToc,
  resizeBook,
  setTextMeasurer,
  sizeForAspect,
  splitChapters,
  THEME_PRESETS,
} from "./index";

const theme = THEME_PRESETS[0].theme;
const longText = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}번째 문장은 한글 조판이 잘 되는지 확인하기 위한 예시 문장입니다.`).join(" ");

describe("countLines", () => {
  it("wraps by words and counts explicit newlines", () => {
    expect(countLines("짧은 문장", 600)).toBe(1);
    expect(countLines("한 줄\n두 줄", 600)).toBe(2);
    expect(countLines("가".repeat(100), 170)).toBeGreaterThanOrEqual(10);
  });
});

describe("text measurer", () => {
  it("uses real measured widths when a measurer and font are given", () => {
    setTextMeasurer((text) => text.length * 10); // 글자당 10px
    try {
      // 97% 안전 폭: 300px → 291px → "가가가가가 가가가가가"(10+1+10=21자=210px)는 한 줄
      expect(countLines("가가가가가 가가가가가", 300, 17, "test")).toBe(1);
      expect(countLines("가".repeat(40), 300, 17, "test")).toBe(2);
      // 글꼴을 모르면 추정치를 쓴다
      expect(countLines("가".repeat(40), 300)).toBe(countLines("가".repeat(40), 300, 17));
    } finally {
      setTextMeasurer(null);
    }
  });
});

describe("parseBody", () => {
  it("splits paragraphs, headings, lists, quotes and images", () => {
    const units = parseBody("첫 문단\n이어지는 줄\n\n## 소제목\n- 하나\n- 둘\n1. 첫째\n> 인용문\n> — 누군가\n![그림](https://x.test/a.png)");
    expect(units).toEqual([
      { kind: "para", text: "첫 문단 이어지는 줄" },
      { kind: "heading", text: "소제목" },
      { kind: "list", items: ["하나", "둘"], ordered: false },
      { kind: "list", items: ["첫째"], ordered: true },
      { kind: "quote", text: "인용문", cite: "누군가" },
      { kind: "image", alt: "그림", src: "https://x.test/a.png" },
    ]);
  });
});

describe("flowUnits", () => {
  const box = { x: 79, y: 191, w: 635, h: 820 };
  it("keeps every block inside the slot box and opens new pages when full", () => {
    const pages = flowUnits(parseBody(Array.from({ length: 12 }, () => longText(3)).join("\n\n")), box);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) for (const b of p.blocks) {
      expect(b.y).toBeGreaterThanOrEqual(box.y);
      expect(b.y + b.h).toBeLessThanOrEqual(box.y + box.h);
    }
  });

  it("loses no text when splitting a long paragraph across pages", () => {
    const text = longText(60);
    const pages = flowUnits([{ kind: "para", text }], box);
    expect(pages.length).toBeGreaterThan(1);
    const joined = pages.flatMap((p) => p.blocks).map((b) => (b.type === "paragraph" ? b.data.text : "")).join(" ");
    expect(joined.replace(/\s+/g, "")).toBe(text.replace(/\s+/g, ""));
  });

  it("promotes a heading at the top of a page to the heading slot", () => {
    const [first] = flowUnits(parseBody("## 시작\n\n본문"), box);
    expect(first.heading).toBe("시작");
    expect(first.blocks).toHaveLength(1);
  });
});

describe("composeBook", () => {
  const book = composeBook({
    id: "bk1",
    title: "테스트 책",
    subtitle: "부제",
    author: "지은이",
    bookType: "ebook",
    sizePreset: "A4",
    theme,
    chapters: [
      { title: "첫 장", summary: "요약", body: longText(80) },
      { title: "둘째 장", body: "짧은 본문" },
    ],
  });

  it("produces a schema-valid book with cover, toc, chapters and back cover", () => {
    expect(Book.safeParse(book).success).toBe(true);
    const ids = book.pages.map((p) => p.layoutId);
    expect(ids[0]).toBe("cover");
    expect(ids[1]).toBe("toc");
    expect(ids.at(-1)).toBe("back-cover");
    expect(ids.filter((id) => id === "chapter-opener")).toHaveLength(2);
    expect(ids.filter((id) => id === "text-1col").length).toBeGreaterThan(2);
  });

  it("fills the table of contents with chapter start pages", () => {
    const toc = book.pages[1].blocks.find((b) => b.type === "toc");
    const openers = book.pages.flatMap((p, i) => (p.layoutId === "chapter-opener" ? [i + 1] : []));
    expect(toc?.type === "toc" && toc.data.entries).toEqual([
      { title: "첫 장", page: openers[0] },
      { title: "둘째 장", page: openers[1] },
    ]);
  });

  it("updates the table of contents after pages move", () => {
    const moved = { ...book, pages: [book.pages[0], book.pages[1], ...book.pages.slice(2).reverse()] };
    const toc = refreshToc(moved).pages[1].blocks.find((b) => b.type === "toc");
    expect(toc?.type === "toc" && toc.data.entries[0].title).toBe("둘째 장");
  });
});

describe("editor helpers", () => {
  const A4 = SIZE_PRESETS.A4;
  it("creates a valid placeholder page for every layout", () => {
    for (const id of LAYOUT_IDS) {
      const page = createPage(id, A4);
      expect(page.layoutId).toBe(id);
      if (id !== "blank") expect(page.blocks.length).toBeGreaterThan(0);
    }
  });

  it("moves slot blocks when switching layouts and keeps the rest", () => {
    const page = createPage("text-1col", A4);
    const next = applyLayout(page, "text-image-right", A4);
    const body = next.blocks.find((b) => b.slot === "body")!;
    expect(body.w).toBe(Math.round(0.44 * A4.width));
    expect(next.blocks.map((b) => b.id)).toEqual(expect.arrayContaining(page.blocks.map((b) => b.id)));
  });

  it("puts a free image into the image slot of the new layout", () => {
    const page = createPage("text-1col", A4);
    const img = { id: "img1", type: "image" as const, x: 10, y: 10, w: 100, h: 100, data: { src: "/x.png", alt: "", fit: "cover" as const } };
    const next = applyLayout({ ...page, blocks: [...page.blocks, img] }, "text-image-right", A4);
    expect(next.blocks.find((b) => b.id === "img1")).toMatchObject({ slot: "image", x: Math.round(0.58 * A4.width) });
  });

  it("moves text that overflows after a layout change to a new page without losing any", () => {
    const book = composeBook({ id: "b", title: "t", bookType: "ebook", sizePreset: "A4", theme, chapters: [{ title: "장", body: Array.from({ length: 20 }, () => longText(2)).join("\n\n") }] });
    const i = book.pages.findIndex((p) => p.layoutId === "text-1col");
    const narrowed = { ...book, pages: book.pages.map((p, j) => (j === i ? applyLayout(p, "text-image-right", A4) : p)) };
    expect(overflowingBlocks(narrowed.pages[i], A4).length).toBeGreaterThan(0);
    const fixed = moveOverflowToNextPage(narrowed, narrowed.pages[i].id);
    expect(fixed.pages.length).toBeGreaterThan(book.pages.length);
    expect(overflowingBlocks(fixed.pages[i], A4)).toHaveLength(0);
    const text = (b: typeof book) => b.pages.flatMap((p) => p.blocks).map((x) => (x.type === "paragraph" ? x.data.text : "")).join("").replace(/\s+/g, "");
    expect(text(fixed)).toBe(text(narrowed));
  });

  it("scales block coordinates when the book size changes", () => {
    const book = composeBook({ id: "b", title: "t", bookType: "ebook", sizePreset: "A4", theme, chapters: [] });
    const square = resizeBook(book, "SQUARE");
    expect(square.size).toMatchObject({ preset: "SQUARE", width: 793, height: 793 });
    expect(square.pages[0].blocks[0].y).toBeLessThan(book.pages[0].blocks[0].y);
  });

  it("splits imported text into chapters on # lines", () => {
    expect(splitChapters("머리말\n# 하나\n본문1\n# 둘\n본문2")).toEqual([
      { title: "하나", body: "머리말\n\n본문1" },
      { title: "둘", body: "본문2" },
    ]);
    expect(splitChapters("제목 없는 글", "메모")).toEqual([{ title: "메모", body: "제목 없는 글" }]);
  });
});

describe("composeImageBook", () => {
  it("keeps the PDF aspect ratio and makes one background page per image", () => {
    expect(sizeForAspect(595, 842)).toEqual({ preset: "CUSTOM", width: 794, height: 1123 });
    expect(sizeForAspect(1920, 1080)).toEqual({ preset: "CUSTOM", width: 1123, height: 632 });
    const book = composeImageBook({ id: "b", title: "PDF", bookType: "ebook", theme, size: sizeForAspect(1920, 1080), images: ["/api/files/a.jpg", "/api/files/b.jpg"] });
    expect(Book.safeParse(book).success).toBe(true);
    expect(book.pages.map((p) => [p.layoutId, p.background?.imageUrl])).toEqual([["blank", "/api/files/a.jpg"], ["blank", "/api/files/b.jpg"]]);
  });
});

describe("search & toc", () => {
  it("finds text in blocks and PDF page text, and builds the toc", async () => {
    const { searchBook, bookToc } = await import("./index");
    const book = composeBook({ id: "b", title: "제주 여행", bookType: "ebook", sizePreset: "A4", theme, chapters: [{ title: "첫 장", body: "한라산은 높다. 한라산 등반" }] });
    book.pages.push({ id: "pdf", layoutId: "blank", blocks: [], searchText: "PDF 안의 한라산 이야기" });
    const hits = searchBook(book, "한라산");
    expect(hits.length).toBe(3);
    expect(hits.at(-1)?.page).toBe(book.pages.length);
    expect(bookToc(book)[0]).toMatchObject({ title: "첫 장" });
    expect(bookToc({ ...book, toc: [{ title: "직접", page: 2, level: 1 }] })).toEqual([{ title: "직접", page: 2, level: 1 }]);
  });
});

describe("composeImageBook — PDF 링크·목차·글", () => {
  it("링크 영역을 투명 핫스팟으로, 북마크를 목차로, 쪽 글을 검색용으로 넣는다", () => {
    const size = { preset: "CUSTOM" as const, width: 1000, height: 1400 };
    const book = composeImageBook({
      id: "x",
      title: "t",
      bookType: "ebook",
      theme: getThemePreset("modern").theme,
      size,
      images: ["/a.jpg", "/b.jpg"],
      texts: ["첫 쪽 글", ""],
      links: [[{ x: 0.1, y: 0.2, w: 0.3, h: 0.05, url: "https://example.com" }], [{ x: 0, y: 0, w: 0.5, h: 0.5, page: 1 }]],
      toc: [{ title: "1장", page: 2, level: 1 }],
    });
    expect(Book.safeParse(book).success).toBe(true);
    const [a, b] = book.pages;
    expect(a.searchText).toBe("첫 쪽 글");
    expect(b.searchText).toBeUndefined();
    expect(a.blocks[0]).toMatchObject({ type: "hotspot", x: 100, y: 280, w: 300, h: 70, action: { type: "url", href: "https://example.com" } });
    expect(b.blocks[0].action).toEqual({ type: "page", page: 1 });
    expect(book.toc).toEqual([{ title: "1장", page: 2, level: 1 }]);
    expect(searchBook(book, "첫 쪽")[0]?.page).toBe(1);
  });
});
