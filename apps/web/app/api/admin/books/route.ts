import { like, limitOf } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const GET = route(async (req) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  const items = getStore().all(
    `SELECT b.id, b.title, b.status, b.version, b.created_at createdAt, b.updated_at updatedAt,
            u.id userId, u.username userUsername, u.name userName
     FROM books b LEFT JOIN users u ON u.id = b.user_id
     ${q ? `WHERE b.title LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\'` : ""}
     ORDER BY b.updated_at DESC LIMIT ?`,
    ...(q ? [like(q), like(q)] : []), limitOf(params.get("limit"), 100),
  );
  return { items };
});
