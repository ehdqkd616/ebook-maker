"use client";

import { useEffect, useRef, useState } from "react";
import type { Book } from "@ebook/schema";
import { BookStage, type StageHandle } from "./viewer/BookStage";

/** 랜딩 첫 화면의 살아 있는 플립북 — 저절로 넘어가고, 직접 끌어 넘겨 볼 수도 있다 */
export function HeroBook({ book, width: maxWidth = 520 }: { book: Book; width?: number }) {
  const ref = useRef<StageHandle>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // 화면이 좁으면 책도 줄인다 (모바일에서 가로로 넘치지 않게)
  const [width, setWidth] = useState(maxWidth);
  useEffect(() => {
    const el = boxRef.current?.parentElement;
    if (!el) return;
    const fit = () => setWidth(Math.max(220, Math.min(maxWidth, el.clientWidth - 48)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const scale = width / 2 / book.size.width;
  const height = Math.round(book.size.height * scale);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (pageRef.current >= book.pages.length - 2) ref.current?.go(0);
      else ref.current?.next();
    }, 3200);
    return () => clearInterval(id);
  }, [paused, book.pages.length]);

  return (
    <div
      ref={boxRef}
      className="relative max-w-full"
      style={{ width: width + 40, height: height + 60 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <BookStage
        book={book}
        scale={scale}
        spread
        startPage={0}
        showPageNumbers
        onFlip={(i) => {
          pageRef.current = i;
          setPage(i);
        }}
        handleRef={ref}
      />
      <div className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: Math.ceil((book.pages.length + 1) / 2) }, (_, k) => (
          <span key={k} className={`h-1.5 rounded-full transition-all ${Math.ceil(page / 2) === k ? "w-5 bg-brand-600" : "w-1.5 bg-black/15"}`} />
        ))}
      </div>
    </div>
  );
}
