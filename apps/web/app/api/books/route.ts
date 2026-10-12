import { requireUser } from "@/lib/server/auth";
import { createBook, listBooks } from "@/lib/server/books";
import { readJson, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const GET = route(async () => {
  const user = await requireUser();
  return { items: listBooks(user).map(({ book: _book, ...rest }) => rest) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const book = createBook(user, (await readJson(req)).doc);
  getStore().audit("book.create", { actorId: user.id, targetType: "book", targetId: book.id, detail: { title: book.title, pages: book.pages.length } });
  return { id: book.id };
});
