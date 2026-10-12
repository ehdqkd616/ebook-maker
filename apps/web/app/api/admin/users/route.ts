import { USER_STATUSES, type UserRow, type UserStatus } from "@ebook/db";
import { like, limitOf, userOut } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const GET = route(async (req) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const status = params.get("status");
  const q = params.get("q")?.trim();
  const where: string[] = [];
  const args: string[] = [];
  if (status && USER_STATUSES.includes(status as UserStatus)) where.push("u.status = ?"), args.push(status);
  if (q) where.push(`(u.username LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')`), args.push(like(q), like(q));
  const rows = getStore().all<UserRow & { credit_balance: number; book_count: number }>(
    `SELECT u.*,
       COALESCE((SELECT SUM(delta) FROM credit_ledger c WHERE c.user_id = u.id), 0) credit_balance,
       (SELECT COUNT(*) FROM books b WHERE b.user_id = u.id) book_count
     FROM users u
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (u.status = 'pending') DESC, u.id DESC LIMIT ?`,
    ...args, limitOf(params.get("limit"), 200),
  );
  return { items: rows.map(userOut) };
});
