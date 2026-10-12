import type { Metadata } from "next";
import { BookEditor } from "@/components/editor/BookEditor";
import { loadOwnedBook } from "@/lib/server/owned-book";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "편집 · Ebook Maker" };

export default async function EditBookPage({ params }: Props) {
  const { id } = await params;
  const { book, version, updatedAt, publication } = await loadOwnedBook(id, `/books/${id}/edit`);
  return <BookEditor initialBook={book} initialVersion={version} initialUpdatedAt={updatedAt} initialPublication={publication} />;
}
