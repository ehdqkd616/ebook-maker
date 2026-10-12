import { adminUsername, hashPassword, passwordProblem, requireUser, revokeUserSessions, verifyPassword } from "@/lib/server/auth";
import { bad, clientIp, HttpError, readJson, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const PATCH = route(async (req) => {
  const user = await requireUser();
  if (user.username === adminUsername()) {
    throw new HttpError(409, "관리자 비밀번호는 서버 .env의 ADMIN_PASSWORD로 관리합니다.", "ADMIN_PASSWORD_MANAGED");
  }
  const { currentPassword, newPassword } = await readJson(req);
  if (!(await verifyPassword(String(currentPassword ?? "").slice(0, 128), user.pw_hash))) {
    throw bad("현재 비밀번호가 올바르지 않습니다.", "INVALID_CREDENTIALS");
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw bad(problem);
  const store = getStore();
  store.run("UPDATE users SET pw_hash = ? WHERE id = ?", await hashPassword(newPassword as string), user.id);
  await revokeUserSessions(user.id, true); // 다른 기기의 세션은 종료
  store.audit("user.password_change", { actorId: user.id, targetType: "user", targetId: user.id, ip: clientIp(req) });
  return { ok: true };
});
