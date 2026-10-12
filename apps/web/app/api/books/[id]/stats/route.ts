import { requireUser } from "@/lib/server/auth";
import { getOwnedBook } from "@/lib/server/books";
import { route } from "@/lib/server/http";
import { bookStats } from "@/lib/server/stats";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  getOwnedBook(id, user);
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  return bookStats(id, days);
});
