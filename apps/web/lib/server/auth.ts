import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { cache } from "react";
import type { UserRow, UserStatus } from "@ebook/db";
import { clientIp, HttpError, isHttps } from "./http";
import { getStore } from "./store";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };
export const SESSION_COOKIE = "eb_sid";
const sessionMs = () => (Number(process.env.SESSION_DAYS) > 0 ? Number(process.env.SESSION_DAYS) : 7) * 86_400_000;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scryptAsync(pw, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}

// 없는 계정일 때도 해시 검증 시간을 맞추기 위한 더미 해시 (계정 존재 여부 노출 방지)
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(64)}`;

export async function verifyPassword(pw: string, stored: string | null | undefined) {
  const [alg, saltHex, hashHex] = (stored ?? DUMMY_HASH).split("$");
  if (alg !== "scrypt") return false;
  const h = await scryptAsync(pw, Buffer.from(saltHex, "hex"), 32, SCRYPT);
  return timingSafeEqual(h, Buffer.from(hashHex, "hex")) && stored != null;
}

// 아이디: 영문·숫자·_·- 3~32자 (모든 프로젝트 공통 규칙). 대소문자는 구분하지 않도록 소문자로 저장
export const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export function usernameProblem(v: string) {
  return USERNAME_RE.test(v) ? null : "아이디는 영문, 숫자, _, - 조합 3~32자여야 합니다.";
}

/** 모든 프로젝트 공통 관리자 아이디 — 비밀번호는 .env의 ADMIN_PASSWORD로 관리 */
export const ADMIN_USERNAME = "admin";
export const adminUsername = () => ADMIN_USERNAME;

export function passwordProblem(pw: unknown) {
  if (typeof pw !== 'string' || pw.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  if (pw.length > 128) return "비밀번호가 너무 깁니다.";
  return null;
}

export function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  for (;;) {
    const pw = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (!passwordProblem(pw)) return pw;
  }
}

export const STATUS_ERRORS: Record<Exclude<UserStatus, "approved">, [string, string]> = {
  pending: ["ACCOUNT_PENDING", "관리자 승인 대기 중입니다. 승인 후 이용할 수 있습니다."],
  rejected: ["ACCOUNT_REJECTED", "가입이 거절되었습니다."],
  suspended: ["ACCOUNT_SUSPENDED", "이용이 정지된 계정입니다. 관리자에게 문의하세요."],
};

// ── 세션 ─────────────────────────────────────────────

export async function createSession(req: Request, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const store = getStore();
  store.run("DELETE FROM sessions WHERE expires_at < ?", now);
  store.run(
    "INSERT INTO sessions (token_hash, user_id, user_agent, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    sha256(token), userId, (req.headers.get("user-agent") ?? "").slice(0, 300), clientIp(req), now, now + sessionMs(),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps(req), // Caddy 뒤에서는 X-Forwarded-Proto=https → true
    sameSite: "strict",
    path: "/",
    maxAge: sessionMs() / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getStore().run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** 비밀번호 변경·정지 시 세션 무효화. keepCurrent면 지금 요청의 세션은 유지 */
export async function revokeUserSessions(userId: number, keepCurrent = false) {
  const keep = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  getStore().run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", userId, keep ? sha256(keep) : "");
}

/** 유효한 세션의 승인된 회원 (서버 컴포넌트·라우트 핸들러 공용, 요청당 한 번만 조회) */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (
    getStore().get<UserRow>(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'approved'`,
      sha256(token), Date.now(),
    ) ?? null
  );
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "로그인이 필요합니다.", "UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "관리자만 접근할 수 있습니다.", "FORBIDDEN");
  return user;
}

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

/**
 * 기동할 때마다 .env의 ADMIN_PASSWORD로 공통 관리자 계정 admin을 맞춘다.
 * 없으면 만들고, 있으면 관리자·승인 상태와 비밀번호를 .env 값으로 되돌린다 — 비밀번호는 .env가 기준.
 */
export async function ensureAdmin(env = process.env) {
  const username = ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  if (!password) return;
  const store = getStore();
  const existing = store.getUserByUsername(username);
  const now = Date.now();
  if (!existing) {
    store.run(
      `INSERT INTO users (username, name, pw_hash, role, status, approved_at, created_at) VALUES (?, '관리자', ?, 'admin', 'approved', ?, ?)`,
      username, await hashPassword(password), now, now,
    );
    console.log(`관리자 계정 생성: ${username}`);
    return;
  }
  const samePassword = await verifyPassword(password, existing.pw_hash);
  if (samePassword && existing.role === "admin" && existing.status === "approved") return;
  store.run(
    `UPDATE users SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, ?), pw_hash = ? WHERE id = ?`,
    now, samePassword ? existing.pw_hash : await hashPassword(password), existing.id,
  );
  if (!samePassword) store.run("DELETE FROM sessions WHERE user_id = ?", existing.id); // 예전 비밀번호로 만든 세션 종료
  console.log(`관리자 계정 동기화: ${username}`);
}

/** 승인 시 가입 축하 크레딧 (SPEC 12). 한 번만 지급 */
export function grantSignupCredits(userId: number, actorId: number) {
  const amount = Number(process.env.SIGNUP_CREDITS ?? 500);
  const store = getStore();
  if (!(amount > 0) || store.get("SELECT 1 FROM credit_ledger WHERE user_id = ? AND reason = 'signup_grant'", userId)) return;
  store.addCredit(userId, amount, "signup_grant", { actorId, memo: "가입 승인" });
}
