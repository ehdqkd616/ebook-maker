import { requireUser } from "@/lib/server/auth";
import { publicationOut, publishBook, setPublicationAccess, unpublishBook } from "@/lib/server/books";
import { readJson, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const pub = publishBook(user, id);
  getStore().audit("book.publish", { actorId: user.id, targetType: "book", targetId: id, detail: { slug: pub.slug } });
  return { publication: publicationOut(pub) };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  unpublishBook(user, id);
  getStore().audit("book.unpublish", { actorId: user.id, targetType: "book", targetId: id });
  return { publication: null };
});

/** 공개 범위·비밀번호 바꾸기 */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const body = await readJson(req);
  const pub = await setPublicationAccess(user, id, body.visibility, body.password);
  getStore().audit("book.access", { actorId: user.id, targetType: "book", targetId: id, detail: { visibility: pub.visibility } });
  return { publication: publicationOut(pub) };
});
