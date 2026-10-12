import { requireUser } from "@/lib/server/auth";
import { deleteBook, getOwnedBook, getPublication, parseDoc, publicationOut, saveBook } from "@/lib/server/books";
import { readJson, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const row = getOwnedBook(id, user);
  return { book: parseDoc(row), version: row.version, publication: publicationOut(getPublication(id)) };
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJson(req);
  return saveBook(user, (await params).id, body.doc, body.version);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  deleteBook(user, id);
  getStore().audit("book.delete", { actorId: user.id, targetType: "book", targetId: id });
  return { ok: true };
});
