"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { PageFlip } from "page-flip";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// page-flip 래퍼. page-flip은 넘겨받은 DOM을 옮기고 destroy() 때 지워 버리므로,
// 숨긴 template에 PageRenderer로 그린 뒤 복제본을 넘긴다 (React가 그 노드를 소유하지 않게).
// 복제본에는 React 이벤트가 없으므로 클릭은 뷰어 루트에서 위임으로 처리한다.

export type StageHandle = { go: (i: number) => void; next: () => void; prev: () => void; pageElements: () => HTMLElement[] };

export function FlipStage({
  book,
  scale,
  startPage,
  showPageNumbers,
  onFlip,
  handleRef,
}: {
  book: Book;
  scale: number;
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
    const block = document.createElement("div");
    block.style.width = "100%";
    block.style.height = "100%";
    hostRef.current!.appendChild(block);

    import("page-flip").then(({ PageFlip }) => {
      if (cancelled) return;
      const pages = Array.from(templateRef.current!.children, (node, i) => {
        const el = node.cloneNode(true) as HTMLElement;
        el.dataset.density = i === 0 || i === total - 1 ? "hard" : "soft";
        el.dataset.pageIndex = String(i);
        return el;
      });
      pagesRef.current = pages;
      const pf = new PageFlip(block, {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        size: "fixed",
        autoSize: false,
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.45,
        flippingTime: 700,
        startPage: currentRef.current,
      });
      pf.loadFromHTML(pages);
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
  }, [scale, width, height, total, book]);

  return (
    <>
      <div ref={hostRef} className="grid h-full w-full place-items-center" />
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
