import { Book } from "@ebook/schema";
import { getPublishedSnapshot } from "./server/books";
import { sampleBook } from "./sample-book";

/** 공개 주소 /b/{slug} · /embed/{slug} — publications 테이블의 공개본 (편집본이 아니라 퍼블리시한 시점의 복사본) */
export function getPublishedBook(slug: string): Book | null {
  if (slug === "sample") return Book.parse(sampleBook);
  return getPublishedSnapshot(slug);
}
