import type { Book } from "@ebook/schema";
import { PageThumb } from "./PageThumb";

/** 책처럼 보이는 표지: 왼쪽 책등 음영 + 종이 두께 + 그림자 */
export function BookCover({ book, width, className = "" }: { book: Pick<Book, "size" | "theme" | "pages">; width: number; className?: string }) {
  const h = (book.size.height * width) / book.size.width;
  return (
    <div className={`relative ${className}`} style={{ width, height: h }}>
      {/* 종이 두께 */}
      <div className="absolute inset-0 translate-x-[5px] translate-y-[3px] rounded-r-[4px] bg-white shadow-sm ring-1 ring-black/5" />
      <div className="absolute inset-0 translate-x-[2.5px] translate-y-[1.5px] rounded-r-[4px] bg-neutral-50 ring-1 ring-black/5" />
      <div className="relative overflow-hidden rounded-r-[4px] rounded-l-[2px] shadow-book">
        <PageThumb book={book} page={book.pages[0]} width={width} className="!shadow-none !ring-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[7%]"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,.22), rgba(255,255,255,.18) 45%, rgba(0,0,0,.06) 70%, transparent)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(255,255,255,.18), transparent 40%)" }} />
      </div>
    </div>
  );
}
