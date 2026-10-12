import {
  SIZE_PRESETS,
  type Block,
  type Book,
  type BookSize,
  type BookType,
  type LayoutId,
  type Page,
  type SizePreset,
  type Theme,
} from "@ebook/schema";
import { getLayout, placeBlocks, toPx, type Box, type SlotContent } from "./defs";

// 규칙 기반 조판 (AI 없이). 챕터 본문 텍스트를 단위(문단·소제목·목록·인용·이미지)로 나누고,
// 글자 폭을 추정해 본문 슬롯 높이를 넘치면 다음 페이지로 넘긴다 (SPEC 7-⑤의 단순 버전).
// 추정치는 renderer/styles.css의 글꼴 크기·줄 간격과 맞춰야 한다.

type Px = { x: number; y: number; w: number; h: number };
type Size = Pick<BookSize, "width" | "height">;

export function newId(prefix = "b") {
  const rand =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

// ── 글자 폭·줄 수 추정 ────────────────────────────────────

const BODY_PX = 17;
const BODY_LH = BODY_PX * 1.75;
const SUBHEAD_PX = 20;
const SUBHEAD_LH = SUBHEAD_PX * 1.3;
const QUOTE_PX = 22;
const QUOTE_LH = QUOTE_PX * 1.6;
const PARA_GAP = Math.round(BODY_PX * 0.9);
const LIST_INDENT = Math.round(BODY_PX * 1.4);
const LIST_ITEM_GAP = BODY_PX * 0.4;
const QUOTE_INDENT = 28; // padding 24 + border 4

const WIDE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/;

function charWidth(ch: string, fontPx: number) {
  if (WIDE.test(ch)) return fontPx * 0.98;
  if (ch === " ") return fontPx * 0.28;
  if (/[A-Z0-9]/.test(ch)) return fontPx * 0.62;
  if (/[a-z]/.test(ch)) return fontPx * 0.53;
  return fontPx * 0.4;
}

const textWidth = (s: string, fontPx: number) => Array.from(s).reduce((w, ch) => w + charWidth(ch, fontPx), 0);

/** 실제 글꼴로 글자 폭(px)을 재는 함수. 브라우저에서 canvas로 넣어 주면 추정 대신 쓴다 */
export type TextMeasurer = (text: string, fontPx: number, fontFamily: string) => number;
let measurer: TextMeasurer | null = null;
export function setTextMeasurer(m: TextMeasurer | null) {
  measurer = m;
}
/** 실측할 때도 렌더링과 줄바꿈이 조금 다를 수 있어 폭을 살짝 줄여 잡는다 */
const MEASURED_SAFETY = 0.97;

function widthFn(fontPx: number, family?: string) {
  const m = measurer;
  if (m && family) return (s: string) => m(s, fontPx, family);
  return (s: string) => textWidth(s, fontPx);
}

/** word-break: keep-all 기준 줄 수 (어절 단위로 넘기고, 한 어절이 한 줄보다 길면 글자 단위로 자른다) */
export function countLines(text: string, maxWidthPx: number, fontPx = BODY_PX, family?: string) {
  const measure = widthFn(fontPx, family);
  const widthPx = measurer && family ? maxWidthPx * MEASURED_SAFETY : maxWidthPx;
  const space = measure(" ");
  let total = 0;
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      total += 1;
      continue;
    }
    let lines = 1;
    let line = 0;
    for (const word of words) {
      const w = measure(word);
      if (w > widthPx) {
        const rest = line > 0 ? widthPx - line - space : widthPx;
        const overflow = w - Math.max(rest, 0);
        if (line > 0 && rest <= 0) lines += 1;
        const extra = Math.ceil(overflow / widthPx);
        lines += extra;
        line = overflow - (extra - 1) * widthPx;
      } else if (line === 0) {
        line = w;
      } else if (line + space + w <= widthPx) {
        line += space + w;
      } else {
        lines += 1;
        line = w;
      }
    }
    total += lines;
  }
  return total;
}

// ── 본문 텍스트 → 단위 ────────────────────────────────────

export type FlowUnit =
  | { kind: "para"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "image"; src: string; alt: string };

/**
 * 가벼운 마크다운: 빈 줄로 문단 구분, `## 소제목`, `- 목록`/`1. 목록`, `> 인용`, `![설명](이미지주소)`.
 * 처음 쓰는 사람도 그냥 글만 붙여 넣으면 문단으로 나뉜다.
 */
export function parseBody(text: string): FlowUnit[] {
  const units: FlowUnit[] = [];
  let para: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (para.length) units.push({ kind: "para", text: para.join(" ") });
    if (list) units.push({ kind: "list", ...list });
    if (quote.length) {
      const last = quote[quote.length - 1];
      const cite = /^[-—–]\s*(.+)$/.exec(last);
      units.push(cite && quote.length > 1 ? { kind: "quote", text: quote.slice(0, -1).join(" "), cite: cite[1] } : { kind: "quote", text: quote.join(" ") });
    }
    para = [];
    list = null;
    quote = [];
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const quoted = /^>\s?(.*)$/.exec(line);
    if (heading) {
      flush();
      units.push({ kind: "heading", text: heading[1] });
    } else if (image) {
      flush();
      units.push({ kind: "image", alt: image[1], src: image[2] });
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (para.length || quote.length || (list && list.ordered !== ordered)) flush();
      list ??= { items: [], ordered };
      list.items.push((bullet ?? numbered)![1]);
    } else if (quoted) {
      if (para.length || list) flush();
      if (quoted[1]) quote.push(quoted[1]);
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return units;
}

// ── 단위 → 블록 (높이 추정) ───────────────────────────────

export type Fonts = { body?: string; heading?: string };

function paraHeight(text: string, w: number, f: Fonts = {}) {
  return Math.ceil(countLines(text, w, BODY_PX, f.body) * BODY_LH);
}
function listHeight(items: string[], w: number, f: Fonts = {}) {
  return Math.ceil(items.reduce((h, it) => h + countLines(it, w - LIST_INDENT, BODY_PX, f.body) * BODY_LH + LIST_ITEM_GAP, 0));
}
function quoteHeight(text: string, cite: string | undefined, w: number, f: Fonts = {}) {
  return Math.ceil(countLines(text, w - QUOTE_INDENT, QUOTE_PX, f.body) * QUOTE_LH + QUOTE_PX * 0.5 + (cite ? 26 : 0));
}
function headingHeight(text: string, w: number, f: Fonts = {}) {
  return Math.ceil(countLines(text, w, SUBHEAD_PX, f.heading) * SUBHEAD_LH);
}

/** 텍스트 블록이 지금 너비에서 차지할 높이 (에디터에서 레이아웃을 바꿀 때도 쓴다) */
export function estimateBlockHeight(block: Block, w = block.w, f: Fonts = {}): number {
  switch (block.type) {
    case "paragraph":
      return block.data.text.split(/\n\s*\n/).reduce((h, p, i) => h + paraHeight(p, w, f) + (i ? PARA_GAP : 0), 0);
    case "heading":
      return headingHeight(block.data.text, w, f);
    case "list":
      return listHeight(block.data.items, w, f);
    case "quote":
      return quoteHeight(block.data.text, block.data.cite, w, f);
    default:
      return block.h;
  }
}

const sentences = (text: string) => text.split(/(?<=[.!?。…])\s+|(?<=다\.)\s*/).filter(Boolean);

/** 남은 높이에 들어가는 만큼 앞부분을 자른다. 아무것도 안 들어가면 null */
function splitText(text: string, w: number, maxH: number, f: Fonts): [string, string] | null {
  let parts = sentences(text);
  if (parts.length <= 1) parts = text.split(/(?<=\s)/); // 문장 하나가 너무 길면 어절 단위로
  let fit = 0;
  for (let i = 1; i <= parts.length; i++) {
    if (paraHeight(parts.slice(0, i).join(" ").trim(), w, f) > maxH) break;
    fit = i;
  }
  if (fit === 0) return null;
  return [parts.slice(0, fit).join(" ").trim(), parts.slice(fit).join(" ").trim()];
}

type FlowPage = { heading?: string; blocks: Block[] };

/**
 * 본문 단위를 슬롯 박스에 차례로 쌓고, 넘치면 새 페이지를 연다.
 * 페이지 맨 앞에 오는 소제목은 레이아웃의 heading 슬롯으로 올린다.
 */
export function flowUnits(units: FlowUnit[], box: Px, opts: { promoteHeadings?: boolean; fonts?: Fonts } = {}): FlowPage[] {
  const f = opts.fonts ?? {};
  const pages: FlowPage[] = [];
  let page: FlowPage = { blocks: [] };
  let y = 0;
  const w = box.w;
  const room = () => box.h - y;
  const newPage = () => {
    if (page.blocks.length || page.heading) pages.push(page);
    page = { blocks: [] };
    y = 0;
  };
  const add = (block: SlotContent, h: number, gap: number) => {
    page.blocks.push({ ...block, id: newId(), slot: "body", x: box.x, y: box.y + y, w, h } as Block);
    y += h + gap;
  };
  const isEmpty = () => page.blocks.length === 0;

  const queue = [...units];
  while (queue.length) {
    const u = queue.shift()!;
    switch (u.kind) {
      case "heading": {
        if (opts.promoteHeadings !== false && isEmpty() && !page.heading) {
          page.heading = u.text;
          break;
        }
        const h = headingHeight(u.text, w, f);
        // 소제목만 페이지 끝에 외롭게 남지 않도록 다음 두 줄 자리까지 확인
        if (!isEmpty() && room() < h + 12 + BODY_LH * 2) {
          newPage();
          queue.unshift(u);
          break;
        }
        add({ type: "heading", data: { text: u.text, level: 3 } }, h, 12);
        break;
      }
      case "para": {
        const h = paraHeight(u.text, w, f);
        if (h <= room()) {
          add({ type: "paragraph", data: { text: u.text } }, h, PARA_GAP);
          break;
        }
        const split = splitText(u.text, w, room(), f);
        if (split && split[0]) {
          add({ type: "paragraph", data: { text: split[0] } }, paraHeight(split[0], w, f), PARA_GAP);
          newPage();
          if (split[1]) queue.unshift({ kind: "para", text: split[1] });
        } else if (!isEmpty()) {
          newPage();
          queue.unshift(u);
        } else {
          // 빈 페이지에도 한 줄이 안 들어가는 경우는 없지만, 무한 반복은 막는다
          add({ type: "paragraph", data: { text: u.text } }, Math.min(h, box.h), PARA_GAP);
        }
        break;
      }
      case "list": {
        const h = listHeight(u.items, w, f);
        if (h <= room()) {
          add({ type: "list", data: { items: u.items, ordered: u.ordered } }, h, PARA_GAP);
          break;
        }
        let fit = 0;
        while (fit < u.items.length && listHeight(u.items.slice(0, fit + 1), w, f) <= room()) fit++;
        if (fit > 0) {
          const head = u.items.slice(0, fit);
          add({ type: "list", data: { items: head, ordered: u.ordered } }, listHeight(head, w, f), PARA_GAP);
        }
        if (fit > 0 || !isEmpty()) {
          newPage();
          if (fit < u.items.length) queue.unshift({ ...u, items: u.items.slice(fit) });
        } else {
          add({ type: "list", data: { items: u.items, ordered: u.ordered } }, Math.min(h, box.h), PARA_GAP);
        }
        break;
      }
      case "quote": {
        const h = quoteHeight(u.text, u.cite, w, f);
        if (h > room() && !isEmpty()) {
          newPage();
          queue.unshift(u);
          break;
        }
        add({ type: "quote", data: { text: u.text, cite: u.cite } }, Math.min(h, box.h), PARA_GAP);
        break;
      }
      case "image": {
        const h = Math.round(Math.min(w * 0.62, box.h * 0.6));
        if (h > room() && !isEmpty()) {
          newPage();
          queue.unshift(u);
          break;
        }
        add({ type: "image", data: { src: u.src, alt: u.alt, fit: "contain" } }, h, PARA_GAP);
        break;
      }
    }
  }
  newPage();
  return pages;
}

// ── 책 조립 ─────────────────────────────────────────────

export type ComposeChapter = { title: string; summary?: string; body?: string };

export type ComposeInput = {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  bookType: BookType;
  sizePreset: SizePreset;
  theme: Theme;
  language?: string;
  chapters: ComposeChapter[];
  includeToc?: boolean;
  includeBackCover?: boolean;
  backCoverMessage?: string;
};

const heading = (text: string, level: 1 | 2 | 3 = 2): SlotContent => ({ type: "heading", data: { text, level } });
const paragraph = (text: string): SlotContent => ({ type: "paragraph", data: { text } });

function slotPage(layoutId: LayoutId, size: Size, slots: Record<string, SlotContent | undefined>, chapterId?: string): Page {
  const id = newId("p");
  return { id, layoutId, chapterId, blocks: placeBlocks(getLayout(layoutId), size, slots, () => newId()) };
}

export const chapterLabel = (i: number) => `CHAPTER ${String(i + 1).padStart(2, "0")}`;

/** 위자드 입력 → 표지·목차·챕터·본문·뒷표지가 들어간 Book */
export function composeBook(input: ComposeInput): Book {
  const size = { preset: input.sizePreset, ...SIZE_PRESETS[input.sizePreset] };
  const chapters = input.chapters
    .map((c) => ({ title: c.title.trim(), summary: c.summary?.trim() ?? "", body: c.body?.trim() ?? "" }))
    .filter((c) => c.title || c.body);
  const outline = {
    chapters: chapters.map((c, i) => ({
      id: newId("ch"),
      title: c.title || `${i + 1}장`,
      summary: c.summary,
      keyPoints: [],
      content: c.body || undefined,
    })),
  };

  const pages: Page[] = [
    slotPage("cover", size, {
      title: heading(input.title, 1),
      subtitle: input.subtitle ? paragraph(input.subtitle) : undefined,
      author: input.author ? paragraph(input.author) : undefined,
    }),
  ];
  if (input.includeToc !== false && outline.chapters.length > 0) pages.push(tocPage(size));

  const body = getLayout("text-1col").slots.find((s) => s.name === "body")!;
  const headingSlot = getLayout("text-1col").slots.find((s) => s.name === "heading")!;
  outline.chapters.forEach((ch, i) => {
    pages.push(
      slotPage(
        "chapter-opener",
        size,
        { number: heading(chapterLabel(i), 3), title: heading(ch.title, 1), summary: ch.summary ? paragraph(ch.summary) : undefined },
        ch.id,
      ),
    );
    if (!ch.content) return;
    const fonts = { body: input.theme.bodyFont, heading: input.theme.headingFont };
    for (const fp of flowUnits(parseBody(ch.content), toPx(body.box, size), { fonts })) {
      const blocks = fp.blocks;
      if (fp.heading) blocks.unshift({ id: newId(), slot: "heading", type: "heading", data: { text: fp.heading, level: 2 }, ...toPx(headingSlot.box, size) });
      pages.push({ id: newId("p"), layoutId: "text-1col", chapterId: ch.id, blocks });
    }
  });

  if (input.includeBackCover !== false) {
    pages.push(
      slotPage("back-cover", size, {
        title: heading(input.title, 2),
        message: paragraph(input.backCoverMessage?.trim() || "읽어 주셔서 감사합니다."),
      }),
    );
  }

  return refreshToc({
    id: input.id,
    title: input.title,
    subtitle: input.subtitle || undefined,
    author: input.author || undefined,
    language: input.language ?? "ko",
    bookType: input.bookType,
    size,
    theme: input.theme,
    outline,
    pages,
    meta: {},
  });
}

/** PDF 원본 비율을 지키는 책 크기 — 긴 쪽을 A4 세로 높이(1123px)에 맞춘다 */
export function sizeForAspect(width: number, height: number): BookSize {
  const LONG = SIZE_PRESETS.A4.height;
  const clamp = (n: number) => Math.min(3000, Math.max(200, Math.round(n)));
  return width >= height
    ? { preset: "CUSTOM", width: LONG, height: clamp((LONG * height) / width) }
    : { preset: "CUSTOM", width: clamp((LONG * width) / height), height: LONG };
}

export type ImageBookInput = {
  id: string;
  title: string;
  author?: string;
  bookType: BookType;
  theme: Theme;
  size: BookSize;
  /** 페이지 순서대로의 이미지 주소 (PDF 각 쪽을 그린 것) */
  images: string[];
  /** 쪽마다의 글 (뷰어 검색용) */
  texts?: string[];
  /** 쪽마다의 링크 영역 (쪽 크기에 대한 비율) → 투명 핫스팟 */
  links?: ({ x: number; y: number; w: number; h: number } & ({ url: string } | { page: number }))[][];
  /** PDF 북마크 → 뷰어 목차 */
  toc?: { title: string; page: number; level: number }[];
};

/** "PDF 그대로 플립북" — 각 쪽 이미지를 빈 페이지의 배경으로 깐다. 위에 글·링크 블록을 더 얹을 수 있다 */
export function composeImageBook(input: ImageBookInput): Book {
  return {
    id: input.id,
    title: input.title,
    author: input.author || undefined,
    language: "ko",
    bookType: input.bookType,
    size: input.size,
    theme: { ...input.theme, background: "#ffffff" },
    outline: { chapters: [] },
    pages: input.images.map((url, i) => ({
      id: newId("p"),
      layoutId: "blank",
      background: { color: "#ffffff", imageUrl: url },
      searchText: input.texts?.[i] || undefined,
      blocks: (input.links?.[i] ?? []).map(
        (l): Block => ({
          id: newId("b"),
          type: "hotspot",
          x: Math.round(l.x * input.size.width),
          y: Math.round(l.y * input.size.height),
          w: Math.max(8, Math.round(l.w * input.size.width)),
          h: Math.max(8, Math.round(l.h * input.size.height)),
          data: { pulse: false },
          action: "url" in l ? { type: "url", href: l.url } : { type: "page", page: l.page },
        }),
      ),
    })),
    toc: input.toc?.length ? input.toc : undefined,
    meta: {},
  };
}

function tocPage(size: Size): Page {
  return slotPage("toc", size, { heading: heading("목차", 2), body: { type: "toc", data: { entries: [] } } });
}

/** 목차 블록을 챕터 시작 페이지 기준으로 다시 채운다 (페이지 순서가 바뀌면 다시 부른다) */
export function refreshToc(book: Book): Book {
  const entries = book.pages.flatMap((p, i) => {
    if (p.layoutId !== "chapter-opener") return [];
    const title = p.blocks.find((b) => b.slot === "title" && b.type === "heading");
    const text = title?.type === "heading" ? title.data.text.replace(/\s*\n\s*/g, " ").trim() : "";
    return text ? [{ title: text, page: i + 1 }] : [];
  });
  let changed = false;
  const pages = book.pages.map((p) => {
    if (!p.blocks.some((b) => b.type === "toc")) return p;
    return {
      ...p,
      blocks: p.blocks.map((b) => {
        if (b.type !== "toc" || JSON.stringify(b.data.entries) === JSON.stringify(entries)) return b;
        changed = true;
        return { ...b, data: { entries } };
      }),
    };
  });
  return changed ? { ...book, pages } : book;
}

// ── 에디터 도우미 ─────────────────────────────────────────

const PLACEHOLDER: Partial<Record<string, SlotContent>> = {
  heading: heading("제목을 입력하세요"),
  title: heading("제목을 입력하세요", 1),
  number: heading("CHAPTER", 3),
  subtitle: paragraph("부제를 입력하세요"),
  author: paragraph("지은이"),
  summary: paragraph("이 장에서 다룰 내용을 짧게 소개해 보세요."),
  body: paragraph("여기에 본문을 입력하세요. 블록을 더블클릭하면 바로 고칠 수 있어요."),
  body2: paragraph("두 번째 단의 본문을 입력하세요."),
  caption: paragraph("이미지 설명"),
  message: paragraph("읽어 주셔서 감사합니다."),
  image: { type: "image", data: { src: "", alt: "", fit: "cover" } },
  quote: { type: "quote", data: { text: "마음에 남는 한 문장을 적어 보세요.", cite: "" } },
};

/** 레이아웃의 슬롯을 자리 표시 내용으로 채운 새 페이지 */
export function createPage(layoutId: LayoutId, size: Size): Page {
  const layout = getLayout(layoutId);
  if (layoutId === "toc") return tocPage(size);
  const slots: Record<string, SlotContent> = {};
  for (const slot of layout.slots) {
    const content = PLACEHOLDER[slot.name];
    if (content && slot.accepts.includes(content.type)) slots[slot.name] = content;
  }
  return slotPage(layoutId, size, slots);
}

const isTextBlock = (b: Block) => b.type === "paragraph" || b.type === "list" || b.type === "quote" || b.type === "heading";

/**
 * 같은 내용을 다른 레이아웃으로: 슬롯 이름이 같은 블록은 새 슬롯 자리로 옮기고
 * (본문처럼 여러 블록이 한 슬롯을 나눠 쓰면 위에서부터 다시 쌓는다), 맞는 슬롯이 없는 블록은 그 자리에 둔다.
 */
export function applyLayout(page: Page, layoutId: LayoutId, size: Size, fonts: Fonts = {}): Page {
  const layout = getLayout(layoutId);
  const groups = new Map<string, Block[]>();
  const blocks: Block[] = [];
  for (const b of page.blocks) {
    const slot = b.slot ? layout.slots.find((s) => s.name === b.slot && s.accepts.includes(b.type)) : undefined;
    if (!slot) {
      blocks.push(b.slot ? { ...b, slot: undefined } : b);
      continue;
    }
    groups.set(slot.name, [...(groups.get(slot.name) ?? []), b]);
  }
  for (const [name, group] of groups) {
    const box = toPx(layout.slots.find((s) => s.name === name)!.box, size);
    if (group.length === 1) {
      blocks.push({ ...group[0], ...box });
      continue;
    }
    let y = box.y;
    for (const b of group) {
      const h = isTextBlock(b) ? estimateBlockHeight(b, box.w, fonts) : Math.round((b.h * box.w) / Math.max(b.w, 1));
      blocks.push({ ...b, x: box.x, y, w: box.w, h });
      y += h + PARA_GAP;
    }
  }
  // 자리 없이 놓인 이미지는 새 레이아웃의 빈 이미지 자리로 옮긴다
  for (const slot of layout.slots) {
    if (groups.has(slot.name) || !slot.accepts.includes("image")) continue;
    const i = blocks.findIndex((b) => !b.slot && b.type === "image");
    if (i < 0) continue;
    blocks[i] = { ...blocks[i], slot: slot.name, ...toPx(slot.box, size) };
    groups.set(slot.name, [blocks[i]]);
  }
  // 새 레이아웃에서 필수인데 비어 있는 슬롯은 자리 표시로 채운다
  for (const slot of layout.slots) {
    if (!slot.required || groups.has(slot.name)) continue;
    const content = slot.name === "body" && layoutId === "toc" ? ({ type: "toc", data: { entries: [] } } as SlotContent) : PLACEHOLDER[slot.name];
    if (content && slot.accepts.includes(content.type)) {
      blocks.push({ ...content, id: newId(), slot: slot.name, ...toPx(slot.box, size) } as Block);
    }
  }
  return { ...page, layoutId, blocks };
}

function bodyBox(layoutId: LayoutId, size: Size) {
  const slot = getLayout(layoutId).slots.find((s) => s.name === "body");
  return slot ? toPx(slot.box, size) : null;
}

/** 본문 자리(body)에서 아래로 넘친 블록들 */
export function overflowingBlocks(page: Page, size: Size): Block[] {
  const box = bodyBox(page.layoutId, size);
  if (!box) return [];
  const bottom = box.y + box.h;
  return page.blocks.filter((b) => b.slot === "body" && b.y + b.h > bottom + 1);
}

function toUnit(b: Block): FlowUnit | null {
  switch (b.type) {
    case "paragraph":
      return { kind: "para", text: b.data.text };
    case "heading":
      return { kind: "heading", text: b.data.text };
    case "list":
      return { kind: "list", items: b.data.items, ordered: b.data.ordered };
    case "quote":
      return { kind: "quote", text: b.data.text, cite: b.data.cite };
    case "image":
      return { kind: "image", src: b.data.src, alt: b.data.alt };
    default:
      return null;
  }
}

/**
 * 본문 자리를 넘친 글을 바로 뒤에 새 본문 페이지로 보낸다.
 * 걸쳐 있는 문단은 들어가는 데까지만 남기고 나머지를 넘긴다.
 */
export function moveOverflowToNextPage(book: Book, pageId: string, fonts: Fonts = {}): Book {
  const index = book.pages.findIndex((p) => p.id === pageId);
  const page = book.pages[index];
  const box = page && bodyBox(page.layoutId, book.size);
  if (!box) return book;
  const bottom = box.y + box.h;
  const overflow = overflowingBlocks(page, book.size);
  if (overflow.length === 0) return book;

  const moved = new Set(overflow.map((b) => b.id));
  const keep: Block[] = [];
  const units: FlowUnit[] = [];
  for (const b of page.blocks) {
    if (!moved.has(b.id)) {
      keep.push(b);
      continue;
    }
    const room = bottom - b.y;
    const split = b.type === "paragraph" && room > BODY_LH ? splitText(b.data.text, b.w, room, fonts) : null;
    if (b.type === "paragraph" && split && split[0] && split[1]) {
      keep.push({ ...b, data: { text: split[0] }, h: paraHeight(split[0], b.w, fonts) });
      units.push({ kind: "para", text: split[1] });
      continue;
    }
    const u = toUnit(b);
    if (u) units.push(u);
  }
  // 이어지는 쪽은 본문 1단으로 (이미지 자리가 있는 레이아웃을 그대로 복제하면 빈 이미지가 생긴다)
  const nextBox = bodyBox("text-1col", book.size)!;
  const newPages: Page[] = flowUnits(units, nextBox, { fonts, promoteHeadings: false }).map((fp) => ({
    id: newId("p"),
    layoutId: "text-1col",
    chapterId: page.chapterId,
    blocks: fp.blocks,
  }));
  const pages = [...book.pages];
  pages.splice(index, 1, { ...page, blocks: keep }, ...newPages);
  return { ...book, pages };
}

/** 책 크기를 바꾸면 블록 좌표를 비율대로 늘이거나 줄인다 */
export function resizeBook(book: Book, preset: SizePreset): Book {
  const next = SIZE_PRESETS[preset];
  const sx = next.width / book.size.width;
  const sy = next.height / book.size.height;
  const scale = (b: Block): Block => ({ ...b, x: Math.round(b.x * sx), y: Math.round(b.y * sy), w: Math.round(b.w * sx), h: Math.round(b.h * sy) });
  return { ...book, size: { preset, ...next }, pages: book.pages.map((p) => ({ ...p, blocks: p.blocks.map(scale) })) };
}

/** `# 제목` 줄로 챕터를 나눈다 (.txt/.md 가져오기). 첫 `#` 앞 내용은 첫 챕터 앞부분에 붙인다 */
export function splitChapters(text: string, fallbackTitle = "1장"): ComposeChapter[] {
  const chapters: ComposeChapter[] = [];
  let current: ComposeChapter | null = null;
  const lead: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m) {
      current = { title: m[1].trim(), body: "" };
      chapters.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      lead.push(line);
    }
  }
  const leadText = lead.join("\n").trim();
  if (chapters.length === 0) return leadText ? [{ title: fallbackTitle, body: leadText }] : [];
  if (leadText) chapters[0].body = `${leadText}\n\n${chapters[0].body}`;
  return chapters.map((c) => ({ ...c, body: c.body?.trim() }));
}

