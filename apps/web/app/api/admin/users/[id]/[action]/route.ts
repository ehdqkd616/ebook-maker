import { changeStatus, conflict, getUserOr404, userOut } from "@/lib/server/admin";
import { adminUsername, hashPassword, requireAdmin, revokeUserSessions, tempPassword } from "@/lib/server/auth";
import { bad, clientIp, HttpError, readJson, route, str } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id, action } = await params;
  const u = getUserOr404(id);
  const ip = clientIp(req);
  const body = await readJson(req);
  const store = getStore();

  switch (action) {
    case "approve":
      if (!["pending", "rejected"].includes(u.status)) throw conflict("대기 또는 거절 상태의 회원만 승인할 수 있습니다.");
      return { user: userOut(await changeStatus(admin, u, "approved", ip)) };

    case "reject":
      if (u.status !== "pending") throw conflict("승인 대기 중인 회원만 거절할 수 있습니다.");
      return { user: userOut(await changeStatus(admin, u, "rejected", ip, str(body.reason, 500) || null)) };

    case "suspend":
      if (u.status !== "approved") throw conflict("승인된 회원만 정지할 수 있습니다.");
      return { user: userOut(await changeStatus(admin, u, "suspended", ip)) };

    case "unsuspend":
      if (u.status !== "suspended") throw conflict("정지된 회원만 해제할 수 있습니다.");
      return { user: userOut(await changeStatus(admin, u, "approved", ip)) };

    // 임시 비밀번호 발급 — 응답으로 한 번만 보여 준다
    case "temp-password": {
      if (u.id === admin.id) throw conflict("본인 비밀번호는 내 정보에서 변경하세요.");
      if (u.username === adminUsername()) throw conflict("관리자 비밀번호는 서버 .env의 ADMIN_PASSWORD로 관리합니다.");
      const pw = tempPassword();
      store.run("UPDATE users SET pw_hash = ? WHERE id = ?", await hashPassword(pw), u.id);
      await revokeUserSessions(u.id);
      store.audit("admin.user.temp_password", { actorId: admin.id, targetType: "user", targetId: u.id, ip });
      return { tempPassword: pw };
    }

    // 크레딧 지급/회수 (원장에 기록만 추가)
    case "credits": {
      const delta = body.delta;
      if (!(typeof delta === "number" && Number.isInteger(delta) && delta !== 0 && Math.abs(delta) <= 1_000_000)) {
        throw bad("크레딧은 0이 아닌 -1,000,000~1,000,000 사이 정수여야 합니다.");
      }
      const memo = str(body.memo, 200) || null;
      store.addCredit(u.id, delta, "admin_adjust", { actorId: admin.id, memo });
      store.audit("admin.user.credits", { actorId: admin.id, targetType: "user", targetId: u.id, detail: { delta, memo }, ip });
      return { user: userOut(getUserOr404(u.id)) };
    }

    default:
      throw new HttpError(404, "not found", "NOT_FOUND");
  }
});
