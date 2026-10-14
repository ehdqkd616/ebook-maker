"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Minus, Plus, X } from "lucide-react";
import type { Block, Book } from "@ebook/schema";

// 텍스트로 읽기 — 쪽 디자인을 걷어 내고 글만 한 줄기로 흘려 보여 준다(작은 화면·큰 글씨용).
// 블록을 위→아래, 왼쪽→오른쪽 순서로 읽고, PDF 쪽은 함께 저장해 둔 쪽 글(searchText)을 쓴다.

const SIZES = [15, 17, 19, 22, 26] as const;
const KEY = "eb-reader";

export function ReaderMode({ book, current, onClose, onGo }: { book: Book; current: number; onClose: () => void; onGo: (i: number) => void }) {
  const [size, setSize] = useState(1);
  const [serif, setSerif] = useState(true);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (typeof v.size === "number") setSize(Math.max(0, Math.min(SIZES.length - 1, v.size)));
      if (typeof v.serif === "boolean") setSerif(v.serif);
    } catch {
      /* 저장 못 해도 읽기는 된다 */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ size, serif }));
    } catch {
      /* 무시 */
    }
  }, [size, serif]);
  useEffect(() => {
    document.getElementById(`reader-p${current}`)?.scrollIntoView({ block: "start" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // 처음 열 때만 지금 쪽으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f7f4ee] text-[#2b2620]" role="dialog" aria-modal aria-label="텍스트로 읽기">
      <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-[#f7f4ee]/90 px-4 py-2.5 backdrop-blur">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{book.title}</p>
        <div className="flex items-center gap-1 rounded-xl bg-black/[0.05] p-0.5 text-sm">
          <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-white disabled:opacity-30" disabled={size === 0} onClick={() => setSize((s) => s - 1)} aria-label="글자 작게"><Minus className="size-4" /></button>
          <span className="w-8 text-center tabular-nums">{SIZES[size]}</span>
          <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-white disabled:opacity-30" disabled={size === SIZES.length - 1} onClick={() => setSize((s) => s + 1)} aria-label="글자 크게"><Plus className="size-4" /></button>
        </div>
        <button type="button" className="rounded-xl bg-black/[0.05] px-3 py-1.5 text-sm hover:bg-black/[0.08]" onClick={() => setSerif((s) => !s)}>{serif ? "명조" : "고딕"}</button>
        <button type="button" className="grid size-9 place-items-center rounded-xl hover:bg-black/[0.06]" onClick={onClose} aria-label="닫기"><X className="size-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <article
          className="mx-auto max-w-2xl px-6 py-10"
          style={{ fontSize: SIZES[size], lineHeight: 1.85, fontFamily: serif ? "'Noto Serif KR', 'Nanum Myeongjo', serif" : "'Pretendard Variable', Pretendard, sans-serif" }}
        >
          {book.pages.map((p, i) => {
            const parts = pageParts(p.blocks, p.searchText);
            if (!parts.length) return null;
            return (
              <section key={p.id} id={`reader-p${i}`} className="scroll-mt-4">
                <button
                  type="button"
                  className="group mt-8 mb-3 flex items-center gap-1 text-[12px] font-semibold tracking-wide text-[#8a7f70] first:mt-0 hover:text-[#2b2620]"
                  onClick={() => {
                    onGo(i);
                    onClose();
                  }}
                >
                  {i + 1}쪽 <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
                </button>
                {parts}
              </section>
            );
          })}
        </article>
      </div>
    </div>
  );
}

function pageParts(blocks: Block[], searchText?: string): React.ReactNode[] {
  const sorted = blocks.filter((b) => !b.hidden).sort((a, b) => (Math.abs(a.y - b.y) < 12 ? a.x - b.x : a.y - b.y));
  const out: React.ReactNode[] = [];
  for (const b of sorted) {
    switch (b.type) {
      case "heading":
        out.push(b.data.level <= 1 ? <h2 key={b.id} className="mt-6 mb-3 text-[1.6em] leading-snug font-bold">{b.data.text}</h2> : <h3 key={b.id} className="mt-5 mb-2 text-[1.25em] leading-snug font-bold">{b.data.text}</h3>);
        break;
      case "paragraph":
        b.data.text.split(/\n\s*\n/).filter((t) => t.trim()).forEach((t, k) => out.push(<p key={`${b.id}${k}`} className="mb-4 whitespace-pre-line">{t.trim()}</p>));
        break;
      case "quote":
        out.push(<blockquote key={b.id} className="my-5 border-l-4 border-[#c9b99a] pl-4 italic">{b.data.text}{b.data.cite && <footer className="mt-1 text-[0.85em] not-italic text-[#8a7f70]">— {b.data.cite}</footer>}</blockquote>);
        break;
      case "list": {
        const L = b.data.ordered ? "ol" : "ul";
        out.push(<L key={b.id} className={`mb-4 pl-6 ${b.data.ordered ? "list-decimal" : "list-disc"}`}>{b.data.items.map((it, k) => <li key={k} className="mb-1">{it}</li>)}</L>);
        break;
      }
      case "image":
        // eslint-disable-next-line @next/next/no-img-element
        if (b.data.src) out.push(<img key={b.id} src={b.data.src} alt={b.data.alt} className="my-5 w-full rounded-lg" loading="lazy" />);
        break;
      case "product":
        out.push(<p key={b.id} className="mb-4 rounded-xl bg-white/70 p-4"><b>{b.data.name}</b>{b.data.price && <span className="ml-2 text-[#8a5a2b]">{b.data.price}</span>}{b.data.description && <span className="mt-1 block text-[0.9em]">{b.data.description}</span>}</p>);
        break;
      case "link":
        out.push(<p key={b.id} className="mb-4"><a href={b.data.href} target="_blank" rel="noopener noreferrer" className="underline">{b.data.text}</a></p>);
        break;
      default:
        break;
    }
  }
  // PDF 쪽(그림): 저장해 둔 쪽 글
  if (searchText && !sorted.some((b) => b.type === "paragraph" || b.type === "heading")) {
    searchText.split(/\n{2,}|\n(?=\S)/).map((t) => t.trim()).filter(Boolean).forEach((t, k) => out.push(<p key={`st${k}`} className="mb-3">{t}</p>));
  }
  return out;
}
