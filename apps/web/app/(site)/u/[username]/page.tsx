import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { listPublicBooks } from "@/lib/server/books";
import { getStore } from "@/lib/server/store";
import { fmtDate } from "@/lib/format";

type Props = { params: Promise<{ username: string }> };

export const dynamic = "force-dynamic";

function owner(username: string) {
  const u = getStore().getUserByUsername(decodeURIComponent(username).toLowerCase());
  return u && u.status === "approved" ? u : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = owner((await params).username);
  return u ? { title: `${u.name}의 책장 · Ebook Maker`, description: `${u.name}님이 공개한 플립북` } : {};
}

/** 공개 책장 — "전체 공개"로 퍼블리시한 책을 모아 보여 준다 */
export default async function BookshelfPage({ params }: Props) {
  const u = owner((await params).username);
  if (!u) notFound();
  const books = listPublicBooks(u.id);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white">{u.name.slice(0, 1)}</span>
        <div>
          <p className="eyebrow">Bookshelf</p>
          <h1 className="text-[28px] font-bold tracking-tight">{u.name}의 책장</h1>
          <p className="muted text-sm">공개한 책 {books.length}권</p>
        </div>
      </div>
      {books.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center">
          <BookOpen className="size-8 text-neutral-300" />
          <p className="mt-3 font-medium">아직 공개한 책이 없어요</p>
        </div>
      ) : (
        <div className="rounded-[28px] bg-gradient-to-b from-[#efe9df] to-[#e4dccd] p-8 shadow-inner">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {books.map((b) => (
              <li key={b.slug} className="group flex flex-col items-center gap-3">
                <Link href={`/b/${b.slug}`} className="relative flex h-56 items-end">
                  <BookCover book={b.book} width={b.book.size.width >= b.book.size.height ? 170 : 130} className="transition duration-300 group-hover:-translate-y-2" />
                </Link>
                <div className="h-2 w-full rounded-full bg-[#c9bba4] shadow-[0_6px_10px_-4px_rgba(0,0,0,.35)]" aria-hidden />
                <div className="text-center">
                  <Link href={`/b/${b.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-700">{b.title}</Link>
                  <p className="text-xs text-neutral-500">{b.pageCount}쪽 · {fmtDate(b.publishedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
