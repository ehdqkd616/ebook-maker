import type { UserRow, UserStatus } from "@ebook/db";
import { grantSignupCredits, revokeUserSessions } from "./auth";
import { HttpError } from "./http";
import { getStore } from "./store";

export const conflict = (message: string) => new HttpError(409, message, "INVALID_STATE");
export const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
export const limitOf = (v: string | null, d: number) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Math.min(Number(v), 500) : d);

type UserWithCounts = UserRow & { credit_balance?: number; book_count?: number };

export function userOut(u: UserWithCounts) {
  const store = getStore();
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    status: u.status,
    signupNote: u.signup_note,
    rejectReason: u.reject_reason,
    creditBalance: u.credit_balance ?? store.creditBalance(u.id),
    bookCount: u.book_count ?? (store.get<{ n: number }>("SELECT COUNT(*) n FROM books WHERE user_id = ?", u.id)?.n ?? 0),
    approvedAt: u.approved_at,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}
export type AdminUser = ReturnType<typeof userOut>;

export function getUserOr404(id: string | number) {
  const u = getStore().getUser(Number(id));
  if (!u) throw new HttpError(404, "회원을 찾을 수 없습니다.", "NOT_FOUND");
  return u;
}

const ACTION: Record<Exclude<UserStatus, "pending">, (old: UserStatus) => string> = {
  approved: (old) => (old === "suspended" ? "unsuspend" : "approve"),
  rejected: () => "reject",
  suspended: () => "suspend",
};

export async function changeStatus(
  admin: UserRow,
  user: UserRow,
  next: Exclude<UserStatus, "pending">,
  ip: string,
  reason: string | null = null,
) {
  if (user.id === admin.id) throw conflict("자기 자신의 상태는 바꿀 수 없습니다.");
  if (user.role === "admin" && next !== "approved") throw conflict("관리자 계정은 거절·정지할 수 없습니다.");
  const store = getStore();
  const now = Date.now();
  store.run(
    `UPDATE users SET status = ?,
       approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
       approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
       reject_reason = CASE WHEN ? = 'rejected' THEN ? WHEN ? = 'approved' THEN NULL ELSE reject_reason END
     WHERE id = ?`,
    next, next, admin.id, next, now, next, reason, next, user.id,
  );
  if (next === "rejected" || next === "suspended") await revokeUserSessions(user.id); // 즉시 로그아웃
  const action = ACTION[next](user.status);
  if (action === "approve") grantSignupCredits(user.id, admin.id);
  store.audit(`admin.user.${action}`, {
    actorId: admin.id, targetType: "user", targetId: user.id,
    detail: { from: user.status, to: next, ...(reason ? { reason } : {}) }, ip,
  });
  return getUserOr404(user.id);
}
