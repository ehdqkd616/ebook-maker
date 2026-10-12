import { cookies } from "next/headers";
import { getPublished, unlockCookieName, unlockToken, type PublishedBook } from "./server/books";
import { Book } from "@ebook/schema";
import { sampleBook } from "./sample-book";

/** 공개 주소용: 공개본 + 비밀번호로 잠겼는지 */
export async function loadPublicBook(slug: string): Promise<(PublishedBook & { locked: boolean }) | null> {
  if (slug === "sample") {
    return { book: Book.parse(sampleBook), bookId: "sample", visibility: "public", passwordHash: null, ownerId: null, publishedAt: 0, locked: false };
  }
  const pub = getPublished(slug);
  if (!pub) return null;
  let locked = false;
  if (pub.visibility === "password" && pub.passwordHash) {
    const got = (await cookies()).get(unlockCookieName(slug))?.value;
    locked = got !== unlockToken(slug, pub.passwordHash);
  }
  return { ...pub, locked };
}

/** OG 이미지로 쓸 그림 — 첫 쪽 배경(PDF) 또는 첫 이미지 블록 */
export function coverImage(book: Book): string | undefined {
  const first = book.pages[0];
  if (first?.background?.imageUrl) return first.background.imageUrl;
  for (const p of book.pages.slice(0, 3)) {
    const img = p.blocks.find((b) => b.type === "image" && b.data.src);
    if (img?.type === "image") return img.data.src;
  }
  return undefined;
}
