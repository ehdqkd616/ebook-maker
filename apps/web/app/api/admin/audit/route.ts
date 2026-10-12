import { limitOf } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const GET = route(async (req) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const action = params.get("action")?.trim();
  const rows = getStore().all<{ detail: string | null }>(
    `SELECT a.id, a.action, a.target_type targetType, a.target_id targetId, a.detail, a.ip, a.created_at createdAt,
            u.username actorUsername
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ${action ? `WHERE a.action LIKE ? ESCAPE '\\'` : ""} ORDER BY a.id DESC LIMIT ?`,
    ...(action ? [`${action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`] : []), limitOf(params.get("limit"), 200),
  );
  return { items: rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null })) };
});
