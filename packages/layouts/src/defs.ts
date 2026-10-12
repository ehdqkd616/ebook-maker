import type { Block, BlockType, BookSize, LayoutId } from "@ebook/schema";

// SPEC 6.2 — 레이아웃 = 슬롯이 정해진 페이지 틀. AI는 "어느 레이아웃의 어느 슬롯에
// 무엇을 넣을지"만 고르고, 좌표는 여기서 정한다.

/** 0~1 비율 좌표. 크기 프리셋마다 px로 재계산한다. */
export type Box = { x: number; y: number; w: number; h: number };

export type SlotDef = {
  name: string;
  accepts: BlockType[];
  box: Box;
  required?: boolean;
  maxChars?: number; // 넘치면 다음 페이지로 (페이지네이션 단계에서 사용)
};

/** 슬롯과 무관하게 항상 그려지는 장식. fill에 "primary" 등 테마 키를 쓸 수 있다. */
export type Decoration = { kind: "rect" | "ellipse" | "line"; box: Box; fill: "primary" | "secondary" | string };

export type LayoutDef = {
  id: LayoutId;
  name: string;
  slots: SlotDef[];
  decorations?: Decoration[];
};

const TEXT = ["paragraph", "list", "quote"] as BlockType[];

export const layouts = {
  cover: {
    id: "cover",
    name: "표지",
    decorations: [
      { kind: "rect", box: { x: 0, y: 0, w: 1, h: 0.62 }, fill: "primary" },
      { kind: "rect", box: { x: 0.1, y: 0.66, w: 0.12, h: 0.006 }, fill: "secondary" },
    ],
    slots: [
      { name: "title", accepts: ["heading"], box: { x: 0.1, y: 0.3, w: 0.8, h: 0.24 }, required: true, maxChars: 40 },
      { name: "subtitle", accepts: ["paragraph"], box: { x: 0.1, y: 0.69, w: 0.8, h: 0.1 }, maxChars: 80 },
      { name: "author", accepts: ["paragraph"], box: { x: 0.1, y: 0.88, w: 0.8, h: 0.04 }, maxChars: 40 },
    ],
  },
  toc: {
    id: "toc",
    name: "목차",
    decorations: [{ kind: "rect", box: { x: 0.1, y: 0.155, w: 0.08, h: 0.005 }, fill: "secondary" }],
    slots: [
      { name: "heading", accepts: ["heading"], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.07 }, maxChars: 20 },
      { name: "body", accepts: ["toc", "list"], box: { x: 0.1, y: 0.19, w: 0.8, h: 0.72 }, required: true },
    ],
  },
  "chapter-opener": {
    id: "chapter-opener",
    name: "챕터 시작",
    decorations: [{ kind: "rect", box: { x: 0, y: 0, w: 0.035, h: 1 }, fill: "primary" }],
    slots: [
      { name: "number", accepts: ["heading"], box: { x: 0.12, y: 0.28, w: 0.76, h: 0.06 }, maxChars: 20 },
      { name: "title", accepts: ["heading"], box: { x: 0.12, y: 0.35, w: 0.76, h: 0.18 }, required: true, maxChars: 40 },
      { name: "summary", accepts: ["paragraph"], box: { x: 0.12, y: 0.58, w: 0.76, h: 0.2 }, maxChars: 200 },
    ],
  },
  "text-1col": {
    id: "text-1col",
    name: "본문 1단",
    slots: [
      { name: "heading", accepts: ["heading"], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.07 }, maxChars: 40 },
      { name: "body", accepts: TEXT, box: { x: 0.1, y: 0.17, w: 0.8, h: 0.73 }, required: true, maxChars: 1100 },
    ],
  },
  "text-2col": {
    id: "text-2col",
    name: "본문 2단",
    slots: [
      { name: "heading", accepts: ["heading"], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.07 }, maxChars: 40 },
      { name: "body", accepts: TEXT, box: { x: 0.1, y: 0.17, w: 0.38, h: 0.73 }, required: true, maxChars: 500 },
      { name: "body2", accepts: TEXT, box: { x: 0.52, y: 0.17, w: 0.38, h: 0.73 }, maxChars: 500 },
    ],
  },
  "text-image-right": {
    id: "text-image-right",
    name: "본문 + 오른쪽 이미지",
    slots: [
      { name: "heading", accepts: ["heading"], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.07 }, maxChars: 40 },
      { name: "body", accepts: TEXT, box: { x: 0.1, y: 0.17, w: 0.44, h: 0.73 }, required: true, maxChars: 600 },
      { name: "image", accepts: ["image"], box: { x: 0.58, y: 0.17, w: 0.32, h: 0.42 } },
      { name: "caption", accepts: ["paragraph"], box: { x: 0.58, y: 0.6, w: 0.32, h: 0.08 }, maxChars: 60 },
    ],
  },
  "text-image-left": {
    id: "text-image-left",
    name: "왼쪽 이미지 + 본문",
    slots: [
      { name: "heading", accepts: ["heading"], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.07 }, maxChars: 40 },
      { name: "image", accepts: ["image"], box: { x: 0.1, y: 0.17, w: 0.32, h: 0.42 } },
      { name: "caption", accepts: ["paragraph"], box: { x: 0.1, y: 0.6, w: 0.32, h: 0.08 }, maxChars: 60 },
      { name: "body", accepts: TEXT, box: { x: 0.46, y: 0.17, w: 0.44, h: 0.73 }, required: true, maxChars: 600 },
    ],
  },
  "image-full-caption": {
    id: "image-full-caption",
    name: "전면 이미지",
    slots: [
      { name: "image", accepts: ["image"], box: { x: 0, y: 0, w: 1, h: 0.76 } },
      { name: "title", accepts: ["heading"], box: { x: 0.1, y: 0.8, w: 0.8, h: 0.06 }, maxChars: 40 },
      { name: "caption", accepts: ["paragraph"], box: { x: 0.1, y: 0.87, w: 0.8, h: 0.08 }, maxChars: 120 },
    ],
  },
  quote: {
    id: "quote",
    name: "인용",
    decorations: [{ kind: "rect", box: { x: 0.1, y: 0.25, w: 0.1, h: 0.006 }, fill: "secondary" }],
    slots: [
      { name: "quote", accepts: ["quote"], box: { x: 0.1, y: 0.3, w: 0.8, h: 0.42 }, required: true, maxChars: 240 },
    ],
  },
  "back-cover": {
    id: "back-cover",
    name: "뒷표지",
    decorations: [
      { kind: "rect", box: { x: 0, y: 0, w: 1, h: 1 }, fill: "primary" },
      { kind: "rect", box: { x: 0.44, y: 0.58, w: 0.12, h: 0.005 }, fill: "secondary" },
    ],
    slots: [
      { name: "title", accepts: ["heading"], box: { x: 0.1, y: 0.42, w: 0.8, h: 0.14 }, maxChars: 40 },
      { name: "message", accepts: ["paragraph"], box: { x: 0.15, y: 0.62, w: 0.7, h: 0.16 }, maxChars: 160 },
    ],
  },
  blank: {
    id: "blank",
    name: "빈 페이지",
    slots: [],
  },
} satisfies Record<LayoutId, LayoutDef>;

export const LAYOUT_LIST: LayoutDef[] = Object.values(layouts);

export function getLayout(id: LayoutId): LayoutDef {
  const layout = (layouts as Record<LayoutId, LayoutDef>)[id];
  if (!layout) throw new Error(`unknown layout: ${id}`);
  return layout;
}

/** 페이지 번호를 찍는 레이아웃 (표지·챕터 시작·전면 이미지 등은 빼고) */
export function showsPageNumber(id: LayoutId) {
  return id.startsWith("text-") || id === "toc" || id === "quote";
}


export function toPx(box: Box, size: Pick<BookSize, "width" | "height">) {
  return {
    x: Math.round(box.x * size.width),
    y: Math.round(box.y * size.height),
    w: Math.round(box.w * size.width),
    h: Math.round(box.h * size.height),
  };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** 슬롯에 넣을 내용 — 좌표·id는 placeBlocks가 채운다. */
export type SlotContent = DistributiveOmit<Block, "id" | "slot" | "x" | "y" | "w" | "h">;

/** 슬롯 내용을 레이아웃 좌표에 배치해 Block[]을 만든다. */
export function placeBlocks(
  layout: LayoutDef,
  size: Pick<BookSize, "width" | "height">,
  contents: Record<string, SlotContent | undefined>,
  makeId: (slot: string) => string = (slot) => `${layout.id}-${slot}`,
): Block[] {
  for (const name of Object.keys(contents)) {
    if (!layout.slots.some((s) => s.name === name)) throw new Error(`unknown slot "${name}" in layout ${layout.id}`);
  }
  const blocks: Block[] = [];
  for (const slot of layout.slots) {
    const content = contents[slot.name];
    if (!content) {
      if (slot.required) throw new Error(`missing required slot "${slot.name}" in layout ${layout.id}`);
      continue;
    }
    if (!slot.accepts.includes(content.type)) {
      throw new Error(`slot "${slot.name}" in layout ${layout.id} does not accept ${content.type}`);
    }
    blocks.push({ ...content, id: makeId(slot.name), slot: slot.name, ...toPx(slot.box, size) } as Block);
  }
  return blocks;
}
