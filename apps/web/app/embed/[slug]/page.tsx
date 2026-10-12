import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { getPublishedBook } from "@/lib/books";

// 다른 사이트에 iframe으로 넣는 플립북 (next.config에서 /embed/*만 X-Frame-Options를 빼 둠)
type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  return book ? { title: book.title, robots: { index: false } } : {};
}

export default async function EmbedBookPage({ params }: Props) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return <FlipbookViewer book={book} />;
}
