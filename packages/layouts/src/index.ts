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
      { name: "body", accepts: ["paragraph", "list", "quote"], box: { x: 0.1, y: 0.17, w: 0.8, h: 0.73 }, required: true, maxChars: 1100 },
    ],
  },
} satisfies Partial<Record<LayoutId, LayoutDef>>;

export type ImplementedLayoutId = keyof typeof layouts;

export function getLayout(id: LayoutId): LayoutDef {
  const layout = (layouts as Partial<Record<LayoutId, LayoutDef>>)[id];
  if (!layout) throw new Error(`layout not implemented: ${id}`);
  return layout;
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
