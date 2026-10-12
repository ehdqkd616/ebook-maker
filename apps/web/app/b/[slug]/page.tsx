import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { getPublishedBook } from "@/lib/books";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  if (!book) return {};
  return { title: book.title, description: book.subtitle, openGraph: { title: book.title, description: book.subtitle } };
}

export default async function PublicBookPage({ params }: Props) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return <FlipbookViewer book={book} />;
}
