import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageText } from "@ebook/layouts";
import { PasswordGate } from "@/components/viewer/PasswordGate";
import { Viewer } from "@/components/viewer/Viewer";
import { coverImage, loadPublicBook } from "@/lib/public-book";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pub = await loadPublicBook((await params).slug);
  if (!pub) return {};
  const { book } = pub;
  const description = book.subtitle || book.author || (pub.locked ? undefined : pageText(book.pages[1] ?? book.pages[0]).slice(0, 150)) || undefined;
  const image = pub.locked ? undefined : coverImage(book);
  return {
    title: book.title,
    description,
    robots: pub.visibility === "public" ? undefined : { index: false, follow: false },
    openGraph: { title: book.title, description, type: "book", images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: book.title, description },
  };
}

export default async function PublicBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const pub = await loadPublicBook(slug);
  if (!pub) notFound();
  if (pub.locked) return <PasswordGate slug={slug} title={pub.book.title} />;
  const page = Number((await searchParams).page);
  return (
    <>
      <Viewer book={pub.book} slug={slug === "sample" ? undefined : slug} initialPage={Number.isInteger(page) && page > 0 ? page : undefined} />
      {/* 검색 엔진·화면 낭독기용 본문 (플립북은 그림처럼 그려지므로) */}
      <div className="sr-only">
        <h1>{pub.book.title}</h1>
        {pub.book.pages.map((p, i) => {
          const t = pageText(p);
          return t ? <p key={p.id}>{i + 1}쪽: {t.slice(0, 2000)}</p> : null;
        })}
      </div>
    </>
  );
}
