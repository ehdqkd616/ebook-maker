import type { Metadata } from "next";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { loadOwnedBook } from "@/lib/server/owned-book";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "미리보기 · Ebook Maker", robots: { index: false } };

/** 편집 중인(저장된) 내용을 플립북으로 — 공개본과 달리 본인만 볼 수 있다 */
export default async function PreviewBookPage({ params }: Props) {
  const { id } = await params;
  const { book } = await loadOwnedBook(id, `/books/${id}/preview`);
  return <FlipbookViewer book={book} backHref={`/books/${id}/edit`} />;
}
