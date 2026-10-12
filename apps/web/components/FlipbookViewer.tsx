"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ListTree, Maximize, Minimize } from "lucide-react";
import type { PageFlip } from "page-flip";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// SPEC 9 — page-flip 뷰어.
// page-flip은 넘겨받은 DOM 노드를 옮기고 destroy() 때 지워 버리므로 React가 그 노드를
// 소유하면 안 된다. 그래서 숨긴 template에 PageRenderer로 그린 뒤, 복제본을 직접 만든
// block에 넣어 page-flip에 넘긴다.

const TOOLBAR_HEIGHT = 56;
const PADDING = 24;

export function FlipbookViewer({ book, backHref }: { book: Book; backHref?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const currentRef = useRef(0);
  const [scale, setScale] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const { width, height } = book.size;
  const total = book.pages.length;
  const chapters = useMemo(
    () =>
      book.pages.flatMap((p, i) => {
        if (p.layoutId !== "chapter-opener") return [];
        const t = p.blocks.find((b) => b.slot === "title" && b.type === "heading");
        return t?.type === "heading" ? [{ index: i, title: t.data.text.replace(/\s*\n\s*/g, " ") }] : [];
      }),
    [book.pages],
  );
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  // 무대 크기 → 배율. 가로로 넓으면 두 쪽 펼침, 아니면 한 쪽.
  useEffect(() => {
    const stage = stageRef.current!;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const cw = stage.clientWidth - PADDING * 2;
      const ch = stage.clientHeight - PADDING * 2;
      const spread = cw > ch;
      const next = Math.min(cw / (spread ? width * 2 : width), ch / height);
      setScale(Math.max(0.1, Math.floor(next * 100) / 100));
    };
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    measure();
    observer.observe(stage);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [width, height]);

  // 배율이 바뀔 때마다 page-flip을 새로 만든다 (현재 페이지는 유지).
  useEffect(() => {
    if (scale === null) return;
    let cancelled = false;
    const block = document.createElement("div");
    block.style.width = "100%";
    block.style.height = "100%";
    stageRef.current!.appendChild(block);

    import("page-flip").then(({ PageFlip }) => {
      if (cancelled) return;
      const pages = Array.from(templateRef.current!.children, (node, i) => {
        const el = node.cloneNode(true) as HTMLElement;
        el.dataset.density = i === 0 || i === total - 1 ? "hard" : "soft";
        return el;
      });
      const pf = new PageFlip(block, {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        size: "fixed",
        autoSize: false,
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.4,
        startPage: currentRef.current,
      });
      pf.loadFromHTML(pages);
      pf.on("flip", (e) => {
        currentRef.current = e.data;
        setCurrent(e.data);
      });
      flipRef.current = pf;
    });

    return () => {
      cancelled = true;
      flipRef.current?.destroy();
      flipRef.current = null;
      block.remove();
    };
  }, [scale, width, height, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipRef.current?.flipNext();
      if (e.key === "ArrowLeft") flipRef.current?.flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={rootRef} className="flex h-dvh flex-col bg-[radial-gradient(120%_80%_at_50%_0%,#3b3550,#16141f_70%)]">
      <div ref={stageRef} className="relative min-h-0 flex-1" style={{ padding: PADDING }} />

      <div className="flex shrink-0 justify-center px-3 pb-3" style={{ height: TOOLBAR_HEIGHT + 12 }}>
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.07] px-2 text-sm text-white/85 shadow-2xl backdrop-blur-xl">
          {backHref && (
            <>
              <a href={backHref} className="flex items-center gap-1.5 rounded-xl px-3 py-2 hover:bg-white/10"><ArrowLeft className="size-4" /> 편집</a>
              <span className="mx-1 h-5 w-px bg-white/15" />
            </>
          )}
          <ViewerButton label="처음으로" disabled={current === 0} onClick={() => flipRef.current?.flip(0)} className="hidden sm:grid"><ChevronsLeft className="size-[18px]" /></ViewerButton>
          <ViewerButton label="이전 페이지" disabled={current === 0} onClick={() => flipRef.current?.flipPrev()}><ChevronLeft className="size-5" /></ViewerButton>
          <span className="min-w-20 text-center font-medium tabular-nums">
            {current + 1} <span className="text-white/45">/ {total}</span>
          </span>
          <ViewerButton label="다음 페이지" disabled={current >= total - 1} onClick={() => flipRef.current?.flipNext()}><ChevronRight className="size-5" /></ViewerButton>
          <ViewerButton label="끝으로" disabled={current >= total - 1} onClick={() => flipRef.current?.flip(total - 1)} className="hidden sm:grid"><ChevronsRight className="size-[18px]" /></ViewerButton>
          <span className="mx-1 h-5 w-px bg-white/15" />
          {chapters.length > 0 && (
            <label className="relative flex items-center rounded-xl hover:bg-white/10">
              <ListTree className="pointer-events-none absolute left-2.5 size-4" />
              <select
                aria-label="목차로 이동"
                className="max-w-36 cursor-pointer appearance-none bg-transparent py-2 pr-3 pl-8 text-white/85 outline-none [&>option]:text-ink"
                value=""
                onChange={(e) => e.target.value && flipRef.current?.flip(Number(e.target.value))}
              >
                <option value="">목차</option>
                {chapters.map((c) => (
                  <option key={c.index} value={c.index}>{c.title}</option>
                ))}
              </select>
            </label>
          )}
          <ViewerButton label="전체 화면" onClick={toggleFullscreen}>{fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}</ViewerButton>
          <span className="ml-1 hidden max-w-48 truncate pr-2 text-white/45 lg:inline">{book.title}</span>
        </div>
      </div>

      <div ref={templateRef} hidden aria-hidden>
        {scale !== null &&
          book.pages.map((page, i) => (
            <div key={page.id}>
              <PageRenderer
                page={page}
                theme={book.theme}
                size={book.size}
                scale={scale}
                pageNumber={showsPageNumber(page.layoutId) ? i + 1 : undefined}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

function ViewerButton({ label, children, disabled, onClick, className = "grid" }: { label: string; children: React.ReactNode; disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`${className} size-9 place-items-center rounded-xl transition hover:bg-white/10 disabled:opacity-30`}>
      {children}
    </button>
  );
}
