import { requireUser } from "@/lib/server/auth";
import { duplicateBook } from "@/lib/server/books";
import { route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  return { id: duplicateBook(user, (await params).id).id };
});
