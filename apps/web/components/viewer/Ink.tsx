"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Highlighter, PenLine, Trash2, Undo2, X } from "lucide-react";

// 판서(펜·형광펜·지우개) — 수업 중에 쪽 위에 바로 쓰고 지운다.
// 선은 쪽 좌표(책 크기 px)로 저장해 쪽과 함께 넘어가고, 이 브라우저에만 남는다(localStorage).

export type Stroke = { c: string; w: number; hl?: boolean; p: number[] }; // p: x,y,x,y…
export type InkTool = { kind: "pen" | "hl" | "eraser"; color: string; width: number };

const PEN_COLORS = ["#111111", "#e5383b", "#2563eb", "#16a34a"] as const;
const HL_COLORS = ["#ffe14d", "#7dffb0", "#ff9ad5"] as const;
const MAX_STROKES_PER_PAGE = 400;

export function useInk(storageKey: string) {
  const [ink, setInk] = useState<Record<number, Stroke[]>>({});
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setInk(JSON.parse(raw));
    } catch {
      /* 저장소를 못 쓰면 이번 방문 동안만 */
    }
    loaded.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        const clean = Object.fromEntries(Object.entries(ink).filter(([, v]) => v.length));
        if (Object.keys(clean).length) localStorage.setItem(storageKey, JSON.stringify(clean));
        else localStorage.removeItem(storageKey);
      } catch {
        /* 가득 찼으면 저장을 건너뛴다 */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [ink, storageKey]);

  const history = useRef<number[]>([]); // 되돌리기: 그은 쪽 순서
  const add = useCallback((page: number, s: Stroke) => {
    history.current.push(page);
    setInk((m) => ({ ...m, [page]: [...(m[page] ?? []), s].slice(-MAX_STROKES_PER_PAGE) }));
  }, []);
  const remove = useCallback((page: number, i: number) => setInk((m) => ({ ...m, [page]: (m[page] ?? []).filter((_, j) => j !== i) })), []);
  const undo = useCallback(() => {
    const page = history.current.pop();
    if (page === undefined) return;
    setInk((m) => ({ ...m, [page]: (m[page] ?? []).slice(0, -1) }));
  }, []);
  const clearPages = useCallback((pages: number[]) => setInk((m) => ({ ...m, ...Object.fromEntries(pages.map((p) => [p, []])) })), []);
  return { ink, add, remove, undo, clearPages };
}

const pathOf = (p: number[]) => {
  if (p.length < 4) return p.length === 2 ? `M${p[0]} ${p[1]}l0.1 0` : "";
  let d = `M${p[0]} ${p[1]}`;
  // 가운데 점을 이어 부드러운 곡선으로
  for (let i = 2; i < p.length - 2; i += 2) d += `Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return `${d}L${p[p.length - 2]} ${p[p.length - 1]}`;
};

/** 한 쪽의 판서 층 */
export function InkLayer({
  width,
  height,
  strokes,
  tool,
  onAdd,
  onRemove,
}: {
  width: number;
  height: number;
  strokes: Stroke[];
  tool: InkTool | null;
  onAdd: (s: Stroke) => void;
  onRemove: (i: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState<Stroke | null>(null);
  const down = useRef(false);
  if (!strokes.length && !tool) return null;

  const at = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * width * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * height * 10) / 10];
  };
  const eraseAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const i = el instanceof SVGPathElement && el.dataset.i !== undefined ? Number(el.dataset.i) : -1;
    if (i >= 0) onRemove(i);
  };

  return (
    <svg
      ref={svgRef}
      data-eb-draw={tool ? "" : undefined}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="absolute inset-0"
      style={{ pointerEvents: tool ? "auto" : "none", touchAction: tool ? "none" : undefined, cursor: tool ? (tool.kind === "eraser" ? "cell" : "crosshair") : undefined }}
      onPointerDown={(e) => {
        if (!tool) return;
        e.stopPropagation();
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        down.current = true;
        if (tool.kind === "eraser") return eraseAt(e);
        setLive({ c: tool.color, w: tool.width, hl: tool.kind === "hl" || undefined, p: at(e) });
      }}
      onPointerMove={(e) => {
        if (!tool || !down.current) return;
        e.stopPropagation();
        if (tool.kind === "eraser") return eraseAt(e);
        const [x, y] = at(e);
        setLive((s) => {
          if (!s) return s;
          const n = s.p.length;
          // 너무 가까운 점은 버려 저장 크기를 줄인다
          if (n >= 2 && Math.hypot(x - s.p[n - 2], y - s.p[n - 1]) < 2) return s;
          return { ...s, p: [...s.p, x, y] };
        });
      }}
      onPointerUp={(e) => {
        if (!tool) return;
        e.stopPropagation();
        down.current = false;
        if (live && live.p.length >= 2) onAdd(live);
        setLive(null);
      }}
      onPointerCancel={() => {
        down.current = false;
        setLive(null);
      }}
      onClick={(e) => tool && e.stopPropagation()}
    >
      {[...strokes, ...(live ? [live] : [])].map((s, i) => (
        <path
          key={i}
          data-i={i < strokes.length ? i : undefined}
          d={pathOf(s.p)}
          fill="none"
          stroke={s.c}
          strokeWidth={s.w}
          strokeLinecap={s.hl ? "butt" : "round"}
          strokeLinejoin="round"
          opacity={s.hl ? 0.4 : 1}
          style={{ mixBlendMode: s.hl ? "multiply" : undefined, pointerEvents: tool?.kind === "eraser" && i < strokes.length ? "stroke" : "none" }}
        />
      ))}
    </svg>
  );
}

/** 판서 도구 막대 */
export function InkPalette({
  tool,
  setTool,
  onUndo,
  onClear,
  onClose,
}: {
  tool: InkTool;
  setTool: (t: InkTool) => void;
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const btn = (on: boolean) => `grid size-9 place-items-center rounded-xl transition ${on ? "bg-white text-ink" : "text-white/80 hover:bg-white/10"}`;
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-black/55 p-1.5 text-white shadow-2xl backdrop-blur-xl" role="toolbar" aria-label="판서 도구">
      <button type="button" className={btn(tool.kind === "pen")} aria-label="펜" title="펜" onClick={() => setTool({ kind: "pen", color: PEN_COLORS.includes(tool.color as (typeof PEN_COLORS)[number]) ? tool.color : PEN_COLORS[1], width: 4 })}>
        <PenLine className="size-[18px]" />
      </button>
      <button type="button" className={btn(tool.kind === "hl")} aria-label="형광펜" title="형광펜" onClick={() => setTool({ kind: "hl", color: HL_COLORS[0], width: 22 })}>
        <Highlighter className="size-[18px]" />
      </button>
      <button type="button" className={btn(tool.kind === "eraser")} aria-label="지우개" title="지우개 (선을 문지르면 지워져요)" onClick={() => setTool({ ...tool, kind: "eraser" })}>
        <Eraser className="size-[18px]" />
      </button>
      <span className="mx-1 h-6 w-px bg-white/15" />
      {(tool.kind === "hl" ? HL_COLORS : PEN_COLORS).map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`색 ${c}`}
          onClick={() => setTool({ ...tool, kind: tool.kind === "eraser" ? "pen" : tool.kind, color: c })}
          className={`size-6 rounded-full ring-2 transition ${tool.color === c && tool.kind !== "eraser" ? "ring-white" : "ring-transparent hover:ring-white/40"}`}
          style={{ background: c }}
        />
      ))}
      {tool.kind === "pen" && (
        <select value={tool.width} onChange={(e) => setTool({ ...tool, width: Number(e.target.value) })} className="ml-1 rounded-lg bg-white/10 px-1.5 py-1 text-xs outline-none" aria-label="굵기">
          {[2, 4, 7, 12].map((w) => <option key={w} value={w} className="text-ink">{w}px</option>)}
        </select>
      )}
      <span className="mx-1 h-6 w-px bg-white/15" />
      <button type="button" className={btn(false)} aria-label="되돌리기" title="되돌리기" onClick={onUndo}><Undo2 className="size-[18px]" /></button>
      <button type="button" className={btn(false)} aria-label="이 쪽 판서 모두 지우기" title="보이는 쪽 모두 지우기" onClick={onClear}><Trash2 className="size-[18px]" /></button>
      <button type="button" className={btn(false)} aria-label="판서 끝내기" title="판서 끝내기" onClick={onClose}><X className="size-[18px]" /></button>
    </div>
  );
}

export const DEFAULT_TOOL: InkTool = { kind: "pen", color: "#e5383b", width: 4 };
