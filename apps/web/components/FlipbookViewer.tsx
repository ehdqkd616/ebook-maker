"use client";

import { useEffect, useRef, useState } from "react";
import type { PageFlip } from "page-flip";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// SPEC 9 — page-flip 뷰어.
// page-flip은 넘겨받은 DOM 노드를 옮기고 destroy() 때 지워 버리므로 React가 그 노드를
// 소유하면 안 된다. 그래서 숨긴 template에 PageRenderer로 그린 뒤, 복제본을 직접 만든
// block에 넣어 page-flip에 넘긴다.

const TOOLBAR_HEIGHT = 56;
const PADDING = 24;

export function FlipbookViewer({ book }: { book: Book }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const currentRef = useRef(0);
  const [scale, setScale] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const { width, height } = book.size;
  const total = book.pages.length;

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
    <div className="flex h-dvh flex-col bg-neutral-800">
      <div ref={stageRef} className="relative min-h-0 flex-1" style={{ padding: PADDING }} />

      <div
        className="flex items-center justify-center gap-4 border-t border-neutral-700 bg-neutral-900 px-4 text-sm text-neutral-200"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={current === 0}
          className="rounded px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-40"
          aria-label="이전 페이지"
        >
          ← 이전
        </button>
        <span className="min-w-24 text-center tabular-nums">
          {current + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={current >= total - 1}
          className="rounded px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-40"
          aria-label="다음 페이지"
        >
          다음 →
        </button>
        <span className="hidden truncate text-neutral-400 sm:inline">{book.title}</span>
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
                pageNumber={page.layoutId === "text-1col" ? i + 1 : undefined}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
