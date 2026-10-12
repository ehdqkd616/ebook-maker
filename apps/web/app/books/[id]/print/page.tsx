import type { Metadata } from "next";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import { PrintToolbar } from "@/components/PrintToolbar";
import { loadOwnedBook } from "@/lib/server/owned-book";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "인쇄·PDF · Ebook Maker", robots: { index: false } };

// SPEC 11 — 인쇄용 페이지. 브라우저의 "PDF로 저장"으로 책 크기 그대로 PDF를 만든다.
// @page 크기를 책 크기(px)에 맞추고, 페이지마다 break-after로 나눈다.
export default async function PrintBookPage({ params }: Props) {
  const { id } = await params;
  const { book } = await loadOwnedBook(id, `/books/${id}/print`);
  const { width, height } = book.size;
  return (
    <>
      <style>{`
        @page { size: ${width}px ${height}px; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .print-toolbar { display: none !important; }
          .print-sheet { margin: 0 !important; box-shadow: none !important; }
        }
        .print-sheet { break-after: page; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-sheet:last-child { break-after: auto; page-break-after: auto; }
      `}</style>
      <PrintToolbar title={book.title} backHref={`/books/${id}/edit`} pages={book.pages.length} />
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
