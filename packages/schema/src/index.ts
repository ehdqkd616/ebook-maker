import { z } from "zod";

// SPEC 6.1 — 에디터·뷰어·PDF·EPUB이 모두 이 Book 문서 하나를 읽어서 렌더링한다.

export const BOOK_TYPES = ["ebook", "guidebook", "textbook", "brochure", "catalog"] as const;
export const BookType = z.enum(BOOK_TYPES);
export type BookType = z.infer<typeof BookType>;

// 크기 프리셋 (px). A4는 FlipHTML5와 같은 794×1123.
export const SIZE_PRESETS = {
  A4: { width: 794, height: 1123 },
  LETTER: { width: 816, height: 1056 },
  SQUARE: { width: 793, height: 793 },
  LANDSCAPE: { width: 1123, height: 794 },
} as const;
export type SizePreset = keyof typeof SIZE_PRESETS;

// CUSTOM: PDF를 그대로 가져올 때처럼 원본 비율을 지키는 크기
export const BookSize = z.object({
  preset: z.enum([...(Object.keys(SIZE_PRESETS) as [SizePreset, ...SizePreset[]]), "CUSTOM"]),
  width: z.number().min(200).max(3000),
  height: z.number().min(200).max(3000),
});
export type BookSize = z.infer<typeof BookSize>;

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "hex color");

export const Theme = z.object({
  templateId: z.string(),
  primary: color,
  secondary: color,
  background: color,
  text: color,
  headingFont: z.string(),
  bodyFont: z.string(),
});
export type Theme = z.infer<typeof Theme>;

export const Chapter = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  content: z.string().optional(), // 본문 생성 후 채워짐 (Markdown)
});
export type Chapter = z.infer<typeof Chapter>;

export const Outline = z.object({ chapters: z.array(Chapter) });
export type Outline = z.infer<typeof Outline>;

export const LAYOUT_IDS = [
  "cover",
  "toc",
  "chapter-opener",
  "text-1col",
  "text-2col",
  "text-image-right",
  "text-image-left",
  "image-full-caption",
  "quote",
  "back-cover",
  "blank", // 슬롯·장식 없는 빈 페이지 (PDF 페이지 이미지 등)
] as const;
export const LayoutId = z.enum(LAYOUT_IDS);
export type LayoutId = z.infer<typeof LayoutId>;

const blockBase = {
  id: z.string(),
  slot: z.string().optional(), // 레이아웃 슬롯 이름 (자동 배치 시)
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
  rotation: z.number().optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
};

export const Block = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("heading"), data: z.object({ text: z.string(), level: z.number().int().min(1).max(3) }) }),
  z.object({ ...blockBase, type: z.literal("paragraph"), data: z.object({ text: z.string() }) }),
  z.object({ ...blockBase, type: z.literal("list"), data: z.object({ items: z.array(z.string()), ordered: z.boolean().default(false) }) }),
  z.object({ ...blockBase, type: z.literal("quote"), data: z.object({ text: z.string(), cite: z.string().optional() }) }),
  z.object({ ...blockBase, type: z.literal("image"), data: z.object({ src: z.string(), alt: z.string().default(""), fit: z.enum(["cover", "contain"]).default("cover") }) }),
  z.object({ ...blockBase, type: z.literal("shape"), data: z.object({ kind: z.enum(["rect", "ellipse", "line"]), fill: z.string().optional() }) }),
  z.object({ ...blockBase, type: z.literal("audio"), data: z.object({ src: z.string() }) }),
  z.object({ ...blockBase, type: z.literal("video"), data: z.object({ src: z.string() }) }),
  z.object({ ...blockBase, type: z.literal("link"), data: z.object({ text: z.string(), href: z.string() }) }),
  // 목차: 챕터 시작 페이지에서 자동으로 채운다 (refreshToc)
  z.object({
    ...blockBase,
    type: z.literal("toc"),
    data: z.object({ entries: z.array(z.object({ title: z.string(), page: z.number().int().positive() })) }),
  }),
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];

export const Page = z.object({
  id: z.string(),
  layoutId: LayoutId,
  chapterId: z.string().optional(),
  background: z.object({ color: z.string().optional(), imageUrl: z.string().optional() }).optional(),
  blocks: z.array(Block),
});
export type Page = z.infer<typeof Page>;

export const Book = z.object({
  id: z.string(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  language: z.string(),
  bookType: BookType,
  size: BookSize,
  theme: Theme,
  outline: Outline,
  pages: z.array(Page),
  meta: z.object({
    audience: z.string().optional(),
    style: z.string().optional(),
    tone: z.string().optional(),
    targetPages: z.number().int().positive().optional(),
  }),
});
export type Book = z.infer<typeof Book>;
