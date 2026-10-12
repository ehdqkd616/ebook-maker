import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book, Page } from "@ebook/schema";

/** 정해진 너비(px)에 맞춰 페이지를 축소해 그린다 — 대시보드 표지, 위자드 미리보기, 에디터 썸네일 공용 */
export function PageThumb({
  book,
  page,
  width,
  index,
  className = "",
}: {
  book: Pick<Book, "size" | "theme">;
  page: Page;
  width: number;
  index?: number;
  className?: string;
}) {
  const scale = width / book.size.width;
  return (
    <div className={`overflow-hidden bg-white shadow-sm ring-1 ring-black/5 ${className}`} style={{ width, height: book.size.height * scale }}>
      <PageRenderer
        page={page}
        theme={book.theme}
        size={book.size}
        scale={scale}
        pageNumber={index !== undefined && showsPageNumber(page.layoutId) ? index + 1 : undefined}
      />
    </div>
  );
}
