"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { PageFlip } from "page-flip";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// page-flip 래퍼. page-flip은 넘겨받은 DOM을 옮기고 destroy() 때 지워 버리므로,
// 숨긴 template에 PageRenderer로 그린 뒤 복제본을 넘긴다 (React가 그 노드를 소유하지 않게).
// 복제본에는 React 이벤트가 없으므로 클릭은 뷰어 루트에서 위임으로 처리한다.

// 원근 거리 = 쪽 너비 × 이 값. page-flip 기본값(2000px 고정)이면 큰 책은 넘기는 동안 40% 넘게
// 부풀어 책 밖·도구 막대까지 덮었다. 뷰어는 부푸는 만큼(1/이 값) 위아래 여유를 남긴다.
export const PERSPECTIVE_RATIO = 10;

export type StageHandle = { go: (i: number) => void; next: () => void; prev: () => void; pageElements: () => HTMLElement[] };

export function FlipStage({
  book,
  scale,
  spread,
  startPage,
  showPageNumbers,
  onFlip,
  handleRef,
}: {
  book: Book;
  scale: number;
  spread: boolean;
  startPage: number;
  showPageNumbers: boolean;
  onFlip: (i: number) => void;
  handleRef: React.Ref<StageHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const currentRef = useRef(startPage);
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;
  const { width, height } = book.size;
  const total = book.pages.length;

  useImperativeHandle(handleRef, () => ({
    go: (i) => flipRef.current?.flip(Math.max(0, Math.min(total - 1, i))),
    next: () => flipRef.current?.flipNext(),
    prev: () => flipRef.current?.flipPrev(),
    pageElements: () => pagesRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    // page-flip 영역을 책 크기와 딱 맞춘다. 남는 공간을 page-flip이 직접 가운데 정렬하게 두면
    // hard 넘김 중에 넘어가지 않는 쪽만 위로 밀려 그려져 양쪽 높이가 어긋났다.
    const pw = Math.round(width * scale);
    const ph = Math.round(height * scale);
    const block = document.createElement("div");
    block.style.width = `${spread ? pw * 2 : pw}px`;
    block.style.height = `${ph}px`;
    block.style.flex = "none";
    hostRef.current!.appendChild(block);

    import("page-flip").then(({ PageFlip }) => {
      if (cancelled) return;
      // 모든 쪽을 hard(3D로 회전)로 넘긴다. soft(종이 말림)는 넘기는 동안 쪽을 비스듬히 잘라
      // 기울여 그려서 글이 찌그러지고, 진한 그림자가 덮이고, 책 아래로 삐져나와 보였다.
      const pages = Array.from(templateRef.current!.children, (node, i) => {
        const el = node.cloneNode(true) as HTMLElement;
        el.dataset.density = "hard";
        el.dataset.pageIndex = String(i);
        return el;
      });
      pagesRef.current = pages;
      const pf = new PageFlip(block, {
        width: pw,
        height: ph,
        size: "fixed",
        autoSize: false,
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.25,
        flippingTime: 700,
        startPage: currentRef.current,
      });
      pf.loadFromHTML(pages);
      const inner = block.querySelector<HTMLElement>(".stf__block");
      if (inner) inner.style.perspective = `${pw * PERSPECTIVE_RATIO}px`;
      pf.on("flip", (e) => {
        currentRef.current = e.data;
        onFlipRef.current(e.data);
      });
      flipRef.current = pf;
      onFlipRef.current(currentRef.current);
    });

    return () => {
      cancelled = true;
      flipRef.current?.destroy();
      flipRef.current = null;
      pagesRef.current = [];
      block.remove();
    };
  }, [scale, spread, width, height, total, book]);

  return (
    <>
      <div ref={hostRef} className="flex h-full w-full items-center justify-center" />
      <div ref={templateRef} hidden aria-hidden>
        {book.pages.map((page, i) => (
          <div key={page.id}>
            <PageRenderer
              page={page}
              theme={book.theme}
              size={book.size}
              scale={scale}
              pageNumber={showPageNumbers && showsPageNumber(page.layoutId) ? i + 1 : undefined}
            />
          </div>
        ))}
      </div>
    </>
  );
}
