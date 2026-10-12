import { randomBytes } from "node:crypto";
import type { UserRow } from "@ebook/db";
import { newId, refreshToc } from "@ebook/layouts";
import { Book } from "@ebook/schema";
import { bad, HttpError } from "./http";
import { getStore } from "./store";

// 책 저장·수정·퍼블리시. Book JSON은 books.doc에, 공개본은 publications.snapshot에 복사해 둔다 (SPEC 10).

export const MAX_DOC_BYTES = 5 * 1024 * 1024;

type BookRow = { id: string; user_id: number | null; title: string; status: string; doc: string; version: number; created_at: number; updated_at: number };
type PublicationRow = { id: string; book_id: string; slug: string; visibility: string; snapshot: string; published_at: number };

export function getOwnedBook(id: string, user: UserRow) {
  const row = getStore().get<BookRow>("SELECT * FROM books WHERE id = ?", id);
  if (!row || row.user_id !== user.id) throw new HttpError(404, "책을 찾을 수 없습니다.", "NOT_FOUND");
  return row;
}

export function parseDoc(row: { doc: string }): Book {
  return Book.parse(JSON.parse(row.doc));
}

export function getPublication(bookId: string) {
  return getStore().get<PublicationRow>("SELECT * FROM publications WHERE book_id = ?", bookId) ?? null;
}

export function publicationOut(p: PublicationRow | null) {
  return p ? { slug: p.slug, visibility: p.visibility, publishedAt: p.published_at } : null;
}

export const MAX_PAGES = 500;

/**
 * 새 책 저장. 조판은 실제 글꼴로 글자 폭을 잴 수 있는 브라우저(위자드)에서 하고,
 * 서버는 스키마·크기만 검증한 뒤 새 ID를 붙여 저장한다.
 */
export function createBook(user: UserRow, rawDoc: unknown) {
  const parsed = Book.safeParse(rawDoc);
  if (!parsed.success) throw bad("책 데이터 형식이 올바르지 않습니다.", "INVALID_DOC");
  const title = parsed.data.title.trim().slice(0, 100);
  if (!title) throw bad("책 제목을 입력해 주세요.");
  if (parsed.data.pages.length === 0) throw bad("페이지가 하나 이상 있어야 합니다.", "INVALID_DOC");
  if (parsed.data.pages.length > MAX_PAGES) throw bad(`페이지는 ${MAX_PAGES}쪽까지 만들 수 있습니다. 챕터를 나눠 여러 권으로 만들어 주세요.`, "TOO_MANY_PAGES");
  return insertBook(user, refreshToc({ ...parsed.data, id: newId("bk"), title }));
}

function insertBook(user: UserRow, book: Book) {
  const doc = JSON.stringify(book);
  if (Buffer.byteLength(doc) > MAX_DOC_BYTES) throw bad("책이 너무 큽니다. 챕터를 나눠서 만들어 주세요.");
  const now = Date.now();
  getStore().run(
    "INSERT INTO books (id, user_id, title, status, doc, version, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, 1, ?, ?)",
    book.id, user.id, book.title, doc, now, now,
  );
  return book;
}

/** 에디터 자동 저장. version이 다르면 다른 탭에서 먼저 저장한 것 → 409 */
export function saveBook(user: UserRow, id: string, rawDoc: unknown, version: unknown) {
  const row = getOwnedBook(id, user);
  if (typeof version !== "number" || version !== row.version) {
    throw new HttpError(409, "다른 창에서 이 책이 먼저 수정되었습니다. 새로고침한 뒤 다시 시도해 주세요.", "VERSION_CONFLICT");
  }
  const parsed = Book.safeParse(rawDoc);
  if (!parsed.success) throw bad("책 데이터 형식이 올바르지 않습니다.", "INVALID_DOC");
  if (parsed.data.id !== id) throw bad("책 ID가 맞지 않습니다.", "INVALID_DOC");
  if (parsed.data.pages.length === 0 || parsed.data.pages.length > MAX_PAGES) throw bad(`페이지는 1~${MAX_PAGES}쪽이어야 합니다.`, "INVALID_DOC");
  const book = refreshToc(parsed.data);
  const doc = JSON.stringify(book);
  if (Buffer.byteLength(doc) > MAX_DOC_BYTES) throw bad("책이 너무 큽니다. (최대 5MB)", "DOC_TOO_LARGE");
  const now = Date.now();
  getStore().run("UPDATE books SET doc = ?, title = ?, version = version + 1, updated_at = ? WHERE id = ?", doc, book.title.slice(0, 100), now, id);
  return { version: row.version + 1, updatedAt: now };
}

export function duplicateBook(user: UserRow, id: string) {
  const src = parseDoc(getOwnedBook(id, user));
  return insertBook(user, { ...src, id: newId("bk"), title: `${src.title} (사본)`.slice(0, 100) });
}

export function deleteBook(user: UserRow, id: string) {
  getOwnedBook(id, user);
  getStore().run("DELETE FROM books WHERE id = ?", id); // publications는 ON DELETE CASCADE
}

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newSlug() {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

/** 지금 편집본을 공개본으로 복사한다. 이미 공개했으면 같은 주소에 덮어쓴다 */
export function publishBook(user: UserRow, id: string) {
  const row = getOwnedBook(id, user);
  const book = refreshToc(parseDoc(row));
  const store = getStore();
  const existing = getPublication(id);
  const now = Date.now();
  if (existing) {
    store.run("UPDATE publications SET snapshot = ?, published_at = ? WHERE id = ?", JSON.stringify(book), now, existing.id);
  } else {
    store.run(
      "INSERT INTO publications (id, book_id, slug, visibility, snapshot, published_at) VALUES (?, ?, ?, 'unlisted', ?, ?)",
      newId("pub"), id, newSlug(), JSON.stringify(book), now,
    );
  }
  store.run("UPDATE books SET status = 'published' WHERE id = ?", id);
  return getPublication(id)!;
}

export function unpublishBook(user: UserRow, id: string) {
  getOwnedBook(id, user);
  const store = getStore();
  store.run("DELETE FROM publications WHERE book_id = ?", id);
  store.run("UPDATE books SET status = 'draft' WHERE id = ?", id);
}

export function getPublishedSnapshot(slug: string): Book | null {
  if (!/^[A-Za-z0-9]{6,20}$/.test(slug)) return null;
  const row = getStore().get<{ snapshot: string }>("SELECT snapshot FROM publications WHERE slug = ?", slug);
  if (!row) return null;
  const parsed = Book.safeParse(JSON.parse(row.snapshot));
  return parsed.success ? parsed.data : null;
}

/** 대시보드용 목록 + 표지 미리보기에 쓸 첫 페이지 */
export function listBooks(user: UserRow) {
  const rows = getStore().all<BookRow & { slug: string | null }>(
    `SELECT b.*, p.slug FROM books b LEFT JOIN publications p ON p.book_id = b.id
     WHERE b.user_id = ? ORDER BY b.updated_at DESC`,
    user.id,
  );
  return rows.flatMap((r) => {
    const parsed = Book.safeParse(JSON.parse(r.doc));
    if (!parsed.success) return [];
    const book = parsed.data;
    return [{ id: r.id, title: r.title, updatedAt: r.updated_at, slug: r.slug, pageCount: book.pages.length, book: { ...book, pages: book.pages.slice(0, 1) } }];
  });
}
