"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";
import type { StageHandle } from "./BookStage";

// 넘김 효과 없는 두 방식: 슬라이드(옆으로 밀기)·세로 스크롤

export function SlideStage({
  book,
  scale,
  current,
  spread,
  showPageNumbers,
  onFlip,
  handleRef,
  renderOverlay,
}: {
  book: Book;
  scale: number;
  current: number;
  spread: boolean;
  showPageNumbers: boolean;
  onFlip: (i: number) => void;
  handleRef: React.Ref<StageHandle>;
  renderOverlay?: (pageIndex: number) => React.ReactNode;
}) {
  const total = book.pages.length;
  const rootRef = useRef<HTMLDivElement>(null);
  // 펼침이면 표지(0) 다음부터 두 쪽씩: [0], [1,2], [3,4]…
  const groups: number[][] = spread
    ? [[0], ...Array.from({ length: Math.ceil((total - 1) / 2) }, (_, g) => [1 + g * 2, 2 + g * 2].filter((i) => i < total))]
    : book.pages.map((_, i) => [i]);
  const groupOf = (i: number) => Math.max(0, groups.findIndex((g) => g.includes(i)));
  const gi = groupOf(current);

  useImperativeHandle(handleRef, () => ({
    go: (i) => onFlip(groups[groupOf(Math.max(0, Math.min(total - 1, i)))][0]),
    next: () => gi < groups.length - 1 && onFlip(groups[gi + 1][0]),
    prev: () => gi > 0 && onFlip(groups[gi - 1][0]),
    pageElements: () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-page-index]") ?? []),
  }));

  // 손가락으로 밀기
  const touch = useRef<number | null>(null);
  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
      onTouchStart={(e) => (touch.current = (e.target as Element).closest?.("[data-eb-draw]") ? null : e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (dx < -40 && gi < groups.length - 1) onFlip(groups[gi + 1][0]);
        if (dx > 40 && gi > 0) onFlip(groups[gi - 1][0]);
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)]" style={{ transform: `translateX(-${gi * 100}%)` }}>
        {groups.map((g, k) => (
          <div key={k} className="grid h-full w-full shrink-0 place-items-center">
            <div className="flex shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]">
              {g.map((i) => (
                <div key={i} data-page-index={i} className="relative">
                  <PageRenderer
                    page={book.pages[i]}
                    theme={book.theme}
                    size={book.size}
                    scale={scale}
                    pageNumber={showPageNumbers && showsPageNumber(book.pages[i].layoutId) ? i + 1 : undefined}
                  />
                  <Overlay book={book} scale={scale} index={i} render={renderOverlay} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScrollStage({
  book,
  scale,
  current,
  showPageNumbers,
  onFlip,
  handleRef,
  renderOverlay,
}: {
  book: Book;
  scale: number;
  current: number;
  showPageNumbers: boolean;
  onFlip: (i: number) => void;
  handleRef: React.Ref<StageHandle>;
  renderOverlay?: (pageIndex: number) => React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const go = (i: number) => {
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-page-index="${i}"]`);
    if (!el) return;
    programmatic.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    onFlip(i);
    setTimeout(() => (programmatic.current = false), 700);
  };
  useImperativeHandle(handleRef, () => ({
    go,
    next: () => go(Math.min(book.pages.length - 1, current + 1)),
    prev: () => go(Math.max(0, current - 1)),
    pageElements: () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-page-index]") ?? []),
  }));

  // 화면 가운데에 걸친 쪽을 지금 쪽으로
  useEffect(() => {
    const root = rootRef.current!;
    const io = new IntersectionObserver(
      (entries) => {
        if (programmatic.current) return;
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) onFlip(Number((vis.target as HTMLElement).dataset.pageIndex));
      },
      { root, threshold: [0.5] },
    );
    root.querySelectorAll("[data-page-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, scale]);

  return (
    <div ref={rootRef} className="h-full w-full overflow-y-auto">
      <div className="flex flex-col items-center gap-6 py-6">
        {book.pages.map((p, i) => (
          <div key={p.id} data-page-index={i} className="relative shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]">
            <PageRenderer page={p} theme={book.theme} size={book.size} scale={scale} pageNumber={showPageNumbers && showsPageNumber(p.layoutId) ? i + 1 : undefined} />
            <Overlay book={book} scale={scale} index={i} render={renderOverlay} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 쪽 위 판서 층 — 책 크기(px) 좌표로 그리고 쪽 배율만큼 줄인다 */
function Overlay({ book, scale, index, render }: { book: Book; scale: number; index: number; render?: (i: number) => React.ReactNode }) {
  if (!render) return null;
  return (
    <div className="absolute top-0 left-0 z-[1]" style={{ width: book.size.width, height: book.size.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      {render(index)}
    </div>
  );
}
