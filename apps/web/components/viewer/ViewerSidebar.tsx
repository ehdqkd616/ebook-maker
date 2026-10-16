"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Bookmark, LayoutGrid, ListTree, Search, X } from "lucide-react";
import { searchBook } from "@ebook/layouts";
import type { Book, TocEntry, ViewerSettings } from "@ebook/schema";
import { PageThumb } from "@/components/PageThumb";

export type SidebarTab = "thumbs" | "toc" | "search" | "bookmarks";

export function ViewerSidebar({
  book,
  tab,
  setTab,
  toc,
  current,
  bookmarks,
  enabled,
  onGo,
  onClose,
}: {
  book: Book;
  tab: SidebarTab;
  setTab: (t: SidebarTab) => void;
  toc: TocEntry[];
  current: number;
  bookmarks: number[];
  enabled: ViewerSettings["buttons"];
  onGo: (i: number) => void;
  onClose: () => void;
}) {
  const tabs = (
    [
      ["thumbs", "썸네일", LayoutGrid, enabled.thumbnails],
      ["toc", "목차", ListTree, enabled.toc && toc.length > 0],
      ["search", "검색", Search, enabled.search],
      ["bookmarks", "책갈피", Bookmark, enabled.bookmarks],
    ] as const
  ).filter((t) => t[3]);

  return (
    <aside className="absolute inset-y-0 left-0 z-30 flex w-full max-w-[320px] flex-col border-r border-white/10 bg-[#15131d]/95 text-white backdrop-blur-xl md:relative md:w-[300px]">
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition ${tab === id ? "bg-white/12 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="닫기" className="ml-1 grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
      <div className="eb-scroll-dark min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "thumbs" && <Thumbs book={book} current={current} onGo={onGo} />}
        {tab === "toc" && (
          <ol className="flex flex-col">
            {toc.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onGo(e.page - 1)}
                  className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/8"
                  style={{ paddingLeft: 10 + (e.level - 1) * 14 }}
                >
                  <span className={`flex-1 ${e.level === 1 ? "font-medium" : "text-white/70"}`}>{e.title}</span>
                  <span className="text-xs text-white/40 tabular-nums">{e.page}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {tab === "search" && <SearchPanel book={book} onGo={onGo} />}
        {tab === "bookmarks" &&
          (bookmarks.length === 0 ? (
            <p className="p-4 text-center text-sm text-white/50">아래 도구 막대의 책갈피 버튼으로 지금 쪽을 표시해 두세요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {bookmarks.map((i) => (
                <button key={i} type="button" onClick={() => onGo(i)} className="flex flex-col items-center gap-1.5 rounded-lg p-1.5 hover:bg-white/8">
                  <PageThumb book={book} page={book.pages[i]} width={110} className="!ring-0" />
                  <span className="text-xs text-white/60">{i + 1}쪽</span>
                </button>
              ))}
            </div>
          ))}
      </div>
    </aside>
  );
}

function Thumbs({ book, current, onGo }: { book: Book; current: number; onGo: (i: number) => void }) {
  // 많을 때도 가볍게: 처음엔 40쪽만, 스크롤하면 더
  const [limit, setLimit] = useState(40);
  return (
    <div
      className="grid grid-cols-2 gap-3"
      onScroll={undefined}
      ref={(el) => {
        const parent = el?.parentElement;
        if (!parent) return;
        parent.onscroll = () => {
          if (parent.scrollTop + parent.clientHeight > parent.scrollHeight - 300) setLimit((l) => Math.min(book.pages.length, l + 40));
        };
      }}
    >
      {book.pages.slice(0, limit).map((p, i) => (
        <button key={p.id} type="button" onClick={() => onGo(i)} className={`flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition ${current === i ? "bg-white/15" : "hover:bg-white/8"}`}>
          <PageThumb book={book} page={p} width={110} className={`!ring-0 ${current === i ? "outline-2 outline-white" : ""}`} />
          <span className="text-xs text-white/60 tabular-nums">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function SearchPanel({ book, onGo }: { book: Book; onGo: (i: number) => void }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const hits = useMemo(() => (dq.trim().length >= 1 ? searchBook(book, dq) : []), [book, dq]);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 focus-within:bg-white/15">
        <Search className="size-4 text-white/50" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="책에서 찾기" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" />
      </label>
      {dq.trim() && <p className="px-1 text-xs text-white/45">{hits.length ? `${new Set(hits.map((h) => h.page)).size}쪽에서 ${hits.length}곳` : "찾는 글이 없어요."}</p>}
      <ul className="flex flex-col gap-1">
        {hits.map((h, i) => (
          <li key={i}>
            <button type="button" onClick={() => onGo(h.page - 1)} className="w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/8">
              <span className="mb-0.5 block text-xs font-semibold text-white/50">{h.page}쪽</span>
              <span className="text-white/80">
                {h.snippet.slice(0, h.start)}
                <mark className="rounded bg-yellow-300/90 px-0.5 text-black">{h.snippet.slice(h.start, h.start + h.length)}</mark>
                {h.snippet.slice(h.start + h.length)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
