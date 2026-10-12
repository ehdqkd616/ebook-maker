import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { getPublishedBook } from "@/lib/books";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  if (!book) return {};
  const description = book.subtitle || book.author || undefined;
  return { title: book.title, description, openGraph: { title: book.title, description, type: "book" } };
}

export default async function PublicBookPage({ params }: Props) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return <FlipbookViewer book={book} />;
}
