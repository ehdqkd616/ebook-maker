import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import { DEFAULT_VIEWER } from "@ebook/schema";
import { PrintToolbar } from "@/components/PrintToolbar";
import { loadPublicBook } from "@/lib/public-book";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** 공개본 PDF 저장·인쇄 — 책 주인이 "다운로드 허용"을 켠 경우만 */
export default async function PublicPrintPage({ params }: Props) {
  const { slug } = await params;
  const pub = await loadPublicBook(slug);
  if (!pub || pub.locked || !(pub.book.viewer ?? DEFAULT_VIEWER).allowDownload) notFound();
  const { book } = pub;
  const { width, height } = book.size;
  return (
    <>
      <style>{`
        @page { size: ${width}px ${height}px; margin: 0; }
        @media print { html, body { background: #fff !important; } .print-toolbar { display: none !important; } .print-sheet { margin: 0 !important; box-shadow: none !important; } }
        .print-sheet { break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-sheet:last-child { break-after: auto; }
      `}</style>
      <PrintToolbar title={book.title} backHref={`/b/${slug}`} pages={book.pages.length} backLabel="플립북으로" />
      <div className="dot-grid flex flex-col items-center gap-8 bg-[#eeedf3] py-8 print:block print:bg-white print:p-0">
        {book.pages.map((page, i) => (
          <div key={page.id} className="print-sheet shadow-lift" style={{ width, height }}>
            <PageRenderer page={page} theme={book.theme} size={book.size} pageNumber={showsPageNumber(page.layoutId) ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </>
  );
}
