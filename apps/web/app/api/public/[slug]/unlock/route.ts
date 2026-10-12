import { verifyPassword } from "@/lib/server/auth";
import { getPublished, unlockCookieName, unlockToken } from "@/lib/server/books";
import { clientIp, HttpError, isHttps, readJson, route } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";

type Ctx = { params: Promise<{ slug: string }> };

// 비밀번호 책 열기 — 맞으면 이 책 주소에서만 쓰는 쿠키를 준다
export const POST = route<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  getLimits().unlock.check(`${clientIp(req)}:${slug}`);
  const pub = getPublished(slug);
  if (!pub || pub.visibility !== "password" || !pub.passwordHash) throw new HttpError(404, "책을 찾을 수 없습니다.", "NOT_FOUND");
  const { password } = await readJson(req);
  if (typeof password !== "string" || !(await verifyPassword(password, pub.passwordHash))) {
    throw new HttpError(401, "비밀번호가 맞지 않습니다.", "WRONG_PASSWORD");
  }
  const res = Response.json({ ok: true });
  const secure = isHttps(req) ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${unlockCookieName(slug)}=${unlockToken(slug, pub.passwordHash)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure}`);
  return res;
});
