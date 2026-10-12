import type { Metadata } from "next";
import { BookStats } from "@/components/BookStats";
import { loadOwnedBook } from "@/lib/server/owned-book";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "통계 · Ebook Maker", robots: { index: false } };

export default async function BookStatsPage({ params }: Props) {
  const { id } = await params;
  const { book, publication } = await loadOwnedBook(id, `/books/${id}/stats`);
  const blockLabels: Record<string, string> = {};
  for (const p of book.pages)
    for (const b of p.blocks) {
      const d = b.data as Record<string, unknown>;
      blockLabels[b.id] = String(d.text ?? d.name ?? d.label ?? d.title ?? "") || { video: "동영상", audio: "오디오", hotspot: "핫스팟", product: "상품", slideshow: "슬라이드쇼", image: "이미지" }[b.type as string] || b.type;
    }
  return <BookStats bookId={id} title={book.title} pageCount={book.pages.length} slug={publication?.slug ?? null} blockLabels={blockLabels} />;
}
