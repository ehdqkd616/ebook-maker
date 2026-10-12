import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { getOwnedBook, getPublication, parseDoc, publicationOut } from "./books";
import { HttpError } from "./http";

/** 서버 컴포넌트용: 로그인한 본인의 책 (아니면 로그인 화면 또는 404) */
export async function loadOwnedBook(id: string, next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  try {
    const row = getOwnedBook(id, user);
    return { book: parseDoc(row), version: row.version, updatedAt: row.updated_at, publication: publicationOut(getPublication(id)) };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
