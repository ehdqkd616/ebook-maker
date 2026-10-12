import { Book } from "@ebook/schema";
import { sampleBook } from "./sample-book";

// TODO(5주차): publications 테이블의 snapshot에서 slug로 조회.
export function getPublishedBook(slug: string): Book | null {
  if (slug === "sample") return Book.parse(sampleBook);
  return null;
}
