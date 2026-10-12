import { createSession, publicUser, STATUS_ERRORS, verifyPassword } from "@/lib/server/auth";
import { clientIp, HttpError, readJson, route, str } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";
import { getStore } from "@/lib/server/store";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const { login, loginGuard } = getLimits();
  login.check(ip);
  const body = await readJson(req);
  // 아이디 형식은 검사하지 않는다 — 예전 가입자는 이메일 형태 아이디를 그대로 쓴다
  const username = str(body.username, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password.slice(0, 128) : "";
  loginGuard.assertNotLocked(username, ip);

  const store = getStore();
  const user = store.getUserByUsername(username);
  if (!(await verifyPassword(password, user?.pw_hash))) {
    loginGuard.recordFailure(username, ip);
    store.audit("login.failure", { actorId: user?.id, targetType: "user", targetId: user?.id, detail: { username }, ip });
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.", "INVALID_CREDENTIALS");
  }
  loginGuard.clear(username);

  // 비밀번호가 맞을 때만 계정 상태를 알려준다
  if (user!.status !== "approved") {
    const [code, message] = STATUS_ERRORS[user!.status];
    store.audit("login.blocked", { actorId: user!.id, targetType: "user", targetId: user!.id, detail: { status: user!.status }, ip });
    throw new HttpError(403, message, code, user!.status === "rejected" && user!.reject_reason ? { reason: user!.reject_reason } : undefined);
  }

  await createSession(req, user!.id);
  const now = Date.now();
  store.run("UPDATE users SET last_login_at = ? WHERE id = ?", now, user!.id);
  store.audit("login.success", { actorId: user!.id, targetType: "user", targetId: user!.id, ip });
  return { user: publicUser({ ...user!, last_login_at: now }) };
});
