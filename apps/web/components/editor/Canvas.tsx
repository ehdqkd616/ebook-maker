"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Block, Book, Page } from "@ebook/schema";
import { updateBlock } from "./ops";

// 가운데 캔버스: PageRenderer로 실제 모습을 그리고, 그 위 투명한 층에서 선택·이동·크기 조절·글 편집을 한다.
// 좌표는 모두 책 원본 px. 화면 px ↔ 책 px는 scale로 바꾼다.

type Update = (fn: (b: Book) => Book, mergeKey?: string) => void;
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type Box = { x: number; y: number; w: number; h: number };
type Drag = { id: string; mode: "move" | Handle; startX: number; startY: number; box: Box; key: string };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_POS: Record<Handle, [number, number]> = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};
const HANDLE_CURSOR: Record<Handle, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
};
const MIN = 8;
const SNAP_PX = 6;

const TEXT_TYPES = new Set(["heading", "paragraph", "list", "quote", "link"]);
const HEADING_PX = { 1: 44, 2: 30, 3: 20 } as Record<number, number>;

export function blockText(b: Block) {
  switch (b.type) {
    case "heading":
    case "paragraph":
    case "quote":
    case "link":
      return b.data.text;
    case "list":
      return b.data.items.join("\n");
    default:
      return "";
  }
}

export function withText(b: Block, text: string): Block {
  switch (b.type) {
    case "heading":
      return { ...b, data: { ...b.data, text } };
    case "paragraph":
      return { ...b, data: { ...b.data, text } };
    case "link":
      return { ...b, data: { ...b.data, text } };
    case "quote":
      return { ...b, data: { ...b.data, text } };
    case "list":
      return { ...b, data: { ...b.data, items: text.split("\n") } };
    default:
      return b;
  }
}

function baseFontPx(b: Block) {
  const fs = Number(b.style?.fontSize);
  if (fs > 0) return fs;
  if (b.type === "heading") return HEADING_PX[b.data.level] ?? 30;
  if (b.type === "quote") return 22;
  return 17;
}

export function Canvas({
  book,
  page,
  index,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onRequestImage,
  update,
  zoom,
}: {
  book: Book;
  page: Page;
  index: number;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onRequestImage: (blockId: string) => void;
  update: Update;
  zoom: number | "fit";
}) {
  const { width: W, height: H } = book.size;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [hover, setHover] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const measure = () => setFit(Math.max(0.1, Math.min((el.clientWidth - 64) / W, (el.clientHeight - 64) / H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  const s = zoom === "fit" ? fit : zoom;

  // 스냅 기준선: 페이지 가장자리·가운데·여백(10%)과 다른 블록의 가장자리·가운데
  const targets = (exclude: string) => {
    const xs = [0, W / 2, W, W * 0.1, W * 0.9];
    const ys = [0, H / 2, H, H * 0.08, H * 0.92];
    for (const b of page.blocks) {
      if (b.id === exclude) continue;
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs, ys };
  };
  const nearest = (values: number[], cands: number[]) => {
    let best: { d: number; t: number; v: number } | null = null;
    for (const v of values) for (const t of cands) {
      const d = t - v;
      if (Math.abs(d) * s <= SNAP_PX && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t, v };
    }
    return best;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / s;
    const dy = (e.clientY - drag.startY) / s;
    const { box } = drag;
    let next: Box;
    const gx: number[] = [];
    const gy: number[] = [];
    const snapOn = !e.altKey;
    const { xs, ys } = targets(drag.id);

    if (drag.mode === "move") {
      next = { ...box, x: box.x + dx, y: box.y + dy };
      if (snapOn) {
        const sx = nearest([next.x, next.x + next.w / 2, next.x + next.w], xs);
        const sy = nearest([next.y, next.y + next.h / 2, next.y + next.h], ys);
        if (sx) { next.x += sx.d; gx.push(sx.t); }
        if (sy) { next.y += sy.d; gy.push(sy.t); }
      }
    } else {
      const m = drag.mode;
      let { x, y, w, h } = box;
      if (m.includes("e")) w = box.w + dx;
      if (m.includes("s")) h = box.h + dy;
      if (m.includes("w")) { x = box.x + dx; w = box.w - dx; }
      if (m.includes("n")) { y = box.y + dy; h = box.h - dy; }
      if (snapOn) {
        if (m.includes("e")) { const r = nearest([x + w], xs); if (r) { w += r.d; gx.push(r.t); } }
        if (m.includes("w")) { const r = nearest([x], xs); if (r) { x += r.d; w -= r.d; gx.push(r.t); } }
        if (m.includes("s")) { const r = nearest([y + h], ys); if (r) { h += r.d; gy.push(r.t); } }
        if (m.includes("n")) { const r = nearest([y], ys); if (r) { y += r.d; h -= r.d; gy.push(r.t); } }
      }
      if (w < MIN) { if (m.includes("w")) x -= MIN - w; w = MIN; }
      if (h < MIN) { if (m.includes("n")) y -= MIN - h; h = MIN; }
      next = { x, y, w, h };
    }
    const r = { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), h: Math.round(next.h) };
    setGuides({ x: gx, y: gy });
    update((bk) => updateBlock(bk, page.id, drag.id, (b) => ({ ...b, ...r })), drag.key);
  };

  const endDrag = () => {
    setDrag(null);
    setGuides({ x: [], y: [] });
  };

  const startDrag = (e: React.PointerEvent, b: Block, mode: Drag["mode"]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(b.id);
    if (editingId === b.id) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ id: b.id, mode, startX: e.clientX, startY: e.clientY, box: { x: b.x, y: b.y, w: b.w, h: b.h }, key: `drag:${b.id}:${Date.now()}` });
  };

  const editing = page.blocks.find((b) => b.id === editingId);

  return (
    <div
      ref={wrapRef}
      className="dot-grid relative min-h-0 min-w-0 flex-1 overflow-auto bg-[#eeedf3]"
      onPointerDown={() => {
        onSelect(null);
        onEdit(null);
      }}
    >
      <div className="grid min-h-full min-w-full place-items-center p-8" style={{ width: "max-content", height: "max-content" }}>
        <div className="relative shadow-lift ring-1 ring-black/5" style={{ width: W * s, height: H * s }} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <PageRenderer page={page} theme={book.theme} size={book.size} scale={s} pageNumber={showsPageNumber(page.layoutId) ? index + 1 : undefined} />

          <div className="absolute inset-0" style={{ cursor: drag ? (drag.mode === "move" ? "grabbing" : HANDLE_CURSOR[drag.mode]) : undefined }}>
            {page.blocks.map((b) => {
              const selected = b.id === selectedId;
              const box = { left: b.x * s, top: b.y * s, width: Math.max(b.w * s, 4), height: Math.max(b.h * s, 4) };
              return (
                <div
                  key={b.id}
                  className="absolute"
                  style={{
                    ...box,
                    transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                    outline: selected ? "2px solid #6339e6" : hover === b.id ? "1px dashed #6339e6" : undefined,
                    outlineOffset: 1,
                    cursor: editingId === b.id ? "text" : "move",
                  }}
                  onPointerEnter={() => setHover(b.id)}
                  onPointerLeave={() => setHover((h) => (h === b.id ? null : h))}
                  onPointerDown={(e) => startDrag(e, b, "move")}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (TEXT_TYPES.has(b.type)) onEdit(b.id);
                    else if (b.type === "image") onRequestImage(b.id);
                  }}
                >
                  {selected && editingId !== b.id &&
                    HANDLES.filter((h) => !(b.h * s < 16 && (h.includes("n") || h.includes("s")) && h.length === 2)).map((h) => (
                      <span
                        key={h}
                        className="absolute size-2.5 rounded-full border-[1.5px] border-brand-600 bg-white shadow-sm"
                        style={{ left: `calc(${HANDLE_POS[h][0] * 100}% - 5px)`, top: `calc(${HANDLE_POS[h][1] * 100}% - 5px)`, cursor: HANDLE_CURSOR[h] }}
                        onPointerDown={(e) => startDrag(e, b, h)}
                      />
                    ))}
                </div>
              );
            })}

            {guides.x.map((x, i) => (
              <div key={`gx${i}`} className="pointer-events-none absolute top-0 bottom-0 w-px bg-fuchsia-500" style={{ left: x * s }} />
            ))}
            {guides.y.map((y, i) => (
              <div key={`gy${i}`} className="pointer-events-none absolute right-0 left-0 h-px bg-fuchsia-500" style={{ top: y * s }} />
            ))}

            {editing && <InlineEditor key={editing.id} block={editing} scale={s} pageId={page.id} update={update} onDone={() => onEdit(null)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 더블클릭한 블록 자리에 바로 띄우는 글 상자. 입력하는 대로 반영되고 Esc·바깥 클릭으로 끝낸다 */
function InlineEditor({ block, scale, pageId, update, onDone }: { block: Block; scale: number; pageId: string; update: Update; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fontPx = baseFontPx(block) * scale;
  useEffect(() => {
    const el = ref.current!;
    el.focus();
    el.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="absolute z-10 resize-none rounded-sm bg-white/95 p-0 shadow-lift outline-2 outline-brand-600"
      style={{
        left: block.x * scale,
        top: block.y * scale,
        width: Math.max(block.w * scale, 120),
        height: Math.max(block.h * scale, fontPx * 2.2),
        fontSize: fontPx,
        lineHeight: block.type === "heading" ? 1.3 : 1.6,
        fontWeight: block.type === "heading" ? 700 : undefined,
        textAlign: (block.style?.textAlign as "left") ?? undefined,
        color: "#111",
      }}
      defaultValue={blockText(block)}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => update((bk) => updateBlock(bk, pageId, block.id, (b) => withText(b, e.target.value)), `text:${block.id}`)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone();
      }}
    />
  );
}
