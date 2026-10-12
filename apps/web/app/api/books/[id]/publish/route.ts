import { requireUser } from "@/lib/server/auth";
import { publicationOut, publishBook, unpublishBook } from "@/lib/server/books";
import { route } from "@/lib/server/http";
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
