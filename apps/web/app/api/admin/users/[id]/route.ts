import { getUserOr404, userOut } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requireAdmin();
  const u = getUserOr404((await params).id);
  const store = getStore();
  const logins = store.all(
    `SELECT action, ip, created_at createdAt FROM audit_log
     WHERE target_type = 'user' AND target_id = ? AND action LIKE 'login.%' ORDER BY id DESC LIMIT 20`,
    String(u.id),
  );
  const credits = store.all(
    `SELECT c.id, c.delta, c.reason, c.memo, c.created_at createdAt, a.username actorUsername
     FROM credit_ledger c LEFT JOIN users a ON a.id = c.actor_id WHERE c.user_id = ? ORDER BY c.id DESC LIMIT 30`,
    u.id,
  );
  const books = store.all(
    "SELECT id, title, status, updated_at updatedAt FROM books WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30",
    u.id,
  );
  return { user: userOut(u), logins, credits, books };
});
