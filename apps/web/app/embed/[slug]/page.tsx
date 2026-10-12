import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasswordGate } from "@/components/viewer/PasswordGate";
import { Viewer } from "@/components/viewer/Viewer";
import { loadPublicBook } from "@/lib/public-book";

// 다른 사이트에 iframe으로 넣는 플립북 (next.config에서 /embed/*만 X-Frame-Options를 빼 둠)
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pub = await loadPublicBook((await params).slug);
  return pub ? { title: pub.book.title, robots: { index: false } } : {};
}

export default async function EmbedBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const pub = await loadPublicBook(slug);
  if (!pub) notFound();
  if (pub.locked) return <PasswordGate slug={slug} title={pub.book.title} />;
  const page = Number((await searchParams).page);
  return <Viewer book={pub.book} slug={slug === "sample" ? undefined : slug} embed initialPage={Number.isInteger(page) && page > 0 ? page : undefined} />;
}
