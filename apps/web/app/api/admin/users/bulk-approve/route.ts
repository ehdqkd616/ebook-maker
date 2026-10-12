import type { UserRow } from "@ebook/db";
import { changeStatus } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { bad, clientIp, readJson, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req);
  const ids = Array.isArray(body.userIds) ? body.userIds.map(Number).filter(Number.isInteger).slice(0, 200) : [];
  if (!ids.length) throw bad("승인할 회원을 선택하세요.");
  const store = getStore();
  const pending = ids
    .map((id: number) => store.get<UserRow>("SELECT * FROM users WHERE id = ? AND status = 'pending'", id))
    .filter((u: UserRow | undefined): u is UserRow => Boolean(u));
  for (const u of pending) await changeStatus(admin, u, "approved", clientIp(req));
  return { approved: pending.length };
});
