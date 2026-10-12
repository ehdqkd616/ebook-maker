import { hashPassword, passwordProblem, usernameProblem } from "@/lib/server/auth";
import { bad, clientIp, HttpError, readJson, route, str } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";
import { getMailer, sendInBackground } from "@/lib/server/mailer";
import { getStore } from "@/lib/server/store";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  getLimits().signup.check(ip);
  const body = await readJson(req);
  const username = str(body.username, 254).toLowerCase();
  const name = str(body.name, 50);
  const note = str(body.signupNote, 1000) || null;
  const idProblem = usernameProblem(username);
  if (idProblem) throw bad(idProblem);
  if (!name) throw bad("이름을 입력하세요.");
  const pwProblem = passwordProblem(body.password);
  if (pwProblem) throw bad(pwProblem);
  if (!body.agreeTerms || !body.agreePrivacy) throw bad("이용약관과 개인정보 처리방침에 동의해 주세요.");

  const store = getStore();
  if (store.getUserByUsername(username)) throw new HttpError(409, "이미 사용 중인 아이디입니다.", "USERNAME_TAKEN");

  const now = Date.now();
  const pwHash = await hashPassword(body.password as string);
  const { lastInsertRowid } = store.run(
    "INSERT INTO users (username, name, pw_hash, signup_note, created_at) VALUES (?, ?, ?, ?, ?)",
    username, name, pwHash, note, now,
  );
  const id = Number(lastInsertRowid);
  store.audit("user.signup", { actorId: id, targetType: "user", targetId: id, ip });
  // 관리자 승인 전에는 로그인할 수 없으므로 세션을 만들지 않는다.
  sendInBackground(getMailer().sendSignupNotification({ username, name, note, createdAt: now }));
  return Response.json(
    { status: "pending", message: "가입 신청이 완료되었습니다. 관리자 승인 후 이용할 수 있습니다." },
    { status: 201 },
  );
});
