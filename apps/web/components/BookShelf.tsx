"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, BookOpen, Eye, Globe2, Link2, Lock, Pencil, Search } from "lucide-react";
import type { Book } from "@ebook/schema";
import { BookCardActions } from "./BookCardActions";
import { BookCover } from "./BookCover";
import { fmtDate } from "@/lib/format";

export type ShelfItem = {
  id: string;
  title: string;
  updatedAt: number;
  slug: string | null;
  visibility: string | null;
  views: number;
  pageCount: number;
  book: Book;
};

const FILTERS = [
  ["all", "전체"],
  ["live", "공개 중"],
  ["draft", "작업 중"],
] as const;

const VIS: Record<string, { icon: typeof Globe2; label: string }> = {
  public: { icon: Globe2, label: "전체 공개" },
  unlisted: { icon: Link2, label: "링크 공개" },
  password: { icon: Lock, label: "비밀번호" },
};

export function BookShelf({ items }: { items: ShelfItem[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [sort, setSort] = useState<"recent" | "title" | "views">("recent");
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .filter((b) => (filter === "all" ? true : filter === "live" ? !!b.slug : !b.slug))
      .filter((b) => !k || b.title.toLowerCase().includes(k))
      .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title, "ko") : sort === "views" ? b.views - a.views : b.updatedAt - a.updatedAt));
  }, [items, q, filter, sort]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">내 책 <span className="ml-1 text-neutral-400">{items.length}</span></h2>
        <label className="flex h-9 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-brand-500/40">
          <Search className="size-4 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목으로 찾기" className="w-36 bg-transparent text-sm outline-none sm:w-48" aria-label="제목으로 찾기" />
        </label>
        <div className="seg">
          {FILTERS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-xl bg-white px-2.5 text-sm ring-1 ring-black/[0.08] outline-none" aria-label="정렬">
          <option value="recent">최근 수정순</option>
          <option value="title">이름순</option>
          <option value="views">조회수순</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-14 text-center">
          <BookOpen className="size-8 text-neutral-300" />
          <p className="mt-3 font-medium">{items.length ? "조건에 맞는 책이 없어요" : "아직 만든 책이 없어요"}</p>
          {!items.length && <Link href="/b/sample" className="btn mt-4">샘플 플립북 둘러보기</Link>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((b) => {
            const landscape = b.book.size.width >= b.book.size.height;
            const vis = b.slug && b.visibility ? VIS[b.visibility] : null;
            return (
              <li key={b.id} className="group flex flex-col gap-3">
                <div className="relative">
                  <Link
                    href={`/books/${b.id}/edit`}
                    className="relative grid h-60 place-items-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#f1eff7] to-[#e6e3ef] ring-1 ring-black/[0.04] transition group-hover:from-brand-50 group-hover:to-brand-100/70"
                  >
                    <div aria-hidden className="absolute inset-x-8 bottom-6 h-6 rounded-[50%] bg-black/20 blur-xl transition group-hover:bg-black/25" />
                    <BookCover book={b.book} width={landscape ? 176 : 124} className="relative transition duration-300 group-hover:-translate-y-2 group-hover:-rotate-1" />
                  </Link>
                  {vis ? (
                    <span className="chip absolute top-3 left-3 bg-white/90 text-emerald-700 shadow-sm ring-1 ring-emerald-200"><vis.icon className="size-3" /> {vis.label}</span>
                  ) : (
                    <span className="chip absolute top-3 left-3 bg-white/80 text-neutral-500 shadow-sm">작업 중</span>
                  )}
                  {/* 마우스를 올리면 바로가기 */}
                  <div className="absolute inset-x-3 bottom-3 flex justify-center gap-1.5 opacity-100 transition sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Link href={`/books/${b.id}/edit`} className="btn bg-white/95 px-2.5 py-1 text-xs shadow-sm"><Pencil className="size-3.5" /> 편집</Link>
                    {b.slug && <Link href={`/b/${b.slug}`} target="_blank" className="btn bg-white/95 px-2.5 py-1 text-xs shadow-sm"><Eye className="size-3.5" /> 보기</Link>}
                    {b.slug && <Link href={`/books/${b.id}/stats`} className="btn bg-white/95 px-2.5 py-1 text-xs shadow-sm"><BarChart3 className="size-3.5" /> 통계</Link>}
                  </div>
                </div>
                <div className="flex items-start gap-2 px-0.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/books/${b.id}/edit`} className="line-clamp-1 font-semibold hover:text-brand-700">{b.title}</Link>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                      <span>{b.pageCount}쪽</span>·<span>{fmtDate(b.updatedAt)}</span>
                      {b.slug && <span className="inline-flex items-center gap-0.5"><Eye className="size-3" />{b.views.toLocaleString()}</span>}
                    </p>
                  </div>
                  <BookCardActions id={b.id} title={b.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
