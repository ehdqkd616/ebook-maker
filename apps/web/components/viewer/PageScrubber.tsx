"use client";

import { useState } from "react";
import type { Book } from "@ebook/schema";
import { PageThumb } from "@/components/PageThumb";

/** 쪽 이동 막대 — 끌면 그 쪽의 작은 그림을 보여 주고, 놓으면 그 쪽으로 넘어간다 */
export function PageScrubber({ book, current, spread, onGo }: { book: Book; current: number; spread: boolean; onGo: (i: number) => void }) {
  const total = book.pages.length;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? current;
  const pct = total > 1 ? (shown / (total - 1)) * 100 : 0;
  const landscape = book.size.width > book.size.height;
  const label = (i: number) => (spread && i > 0 && i < total - 1 ? (i % 2 ? `${i + 1}-${i + 2}` : `${i}-${i + 1}`) : `${i + 1}`);

  return (
    <div className="relative z-20 mx-auto -mb-1 w-full max-w-xl px-6">
      {hover !== null && (
        <div className="pointer-events-none absolute bottom-7 -translate-x-1/2" style={{ left: `calc(24px + (100% - 48px) * ${pct / 100})` }}>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-black/70 p-1.5 shadow-2xl backdrop-blur">
            <PageThumb book={book} page={book.pages[hover]} width={landscape ? 120 : 84} className="!ring-0" />
            <span className="text-[11px] font-semibold text-white tabular-nums">{label(hover)}쪽</span>
          </div>
        </div>
      )}
      <input
        type="range"
        min={0}
        max={total - 1}
        value={shown}
        aria-label="쪽 이동"
        className="eb-scrubber w-full"
        style={{ ["--p" as string]: `${pct}%` }}
        onPointerDown={() => setHover(current)}
        onChange={(e) => setHover(Number(e.target.value))}
        onPointerUp={(e) => {
          const i = Number((e.target as HTMLInputElement).value);
          setHover(null);
          if (i !== current) onGo(i);
        }}
        onKeyUp={(e) => {
          const i = Number((e.target as HTMLInputElement).value);
          setHover(null);
          if (i !== current) onGo(i);
        }}
        onBlur={() => setHover(null)}
      />
    </div>
  );
}
