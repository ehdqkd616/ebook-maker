import { HttpError } from "./http";

// 요청 제한·로그인 잠금 (프로세스 메모리). 다중 인스턴스로 늘리면 Redis로 옮긴다.

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private limit: number, private windowMs = 60_000) {}

  check(key: string) {
    const now = Date.now();
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    if (++entry.count > this.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new HttpError(429, `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도하세요.`, "RATE_LIMITED", { retryAfter });
    }
  }
}

/** 아이디·IP별 로그인 실패 잠금 */
export class LoginGuard {
  private fails = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxFailures = 5, private lockMs = 15 * 60_000) {}

  private keys(username: string, ip: string) {
    return [`user:${username}`, `ip:${ip}`];
  }

  assertNotLocked(username: string, ip: string) {
    const now = Date.now();
    for (const key of this.keys(username, ip)) {
      const f = this.fails.get(key);
      if (f && f.resetAt > now && f.count >= this.maxFailures) {
        const minutes = Math.ceil((f.resetAt - now) / 60_000);
        throw new HttpError(429, `로그인 시도가 너무 많습니다. 약 ${minutes}분 후 다시 시도하세요.`, "LOGIN_LOCKED");
      }
    }
  }

  recordFailure(username: string, ip: string) {
    const now = Date.now();
    for (const key of this.keys(username, ip)) {
      const f = this.fails.get(key);
      if (!f || f.resetAt <= now) this.fails.set(key, { count: 1, resetAt: now + this.lockMs });
      else f.count++;
    }
  }

  clear(username: string) {
    this.fails.delete(`user:${username}`);
  }
}

const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);

const g = globalThis as unknown as { __ebookLimits?: ReturnType<typeof createLimits> };

function createLimits() {
  return {
    login: new RateLimiter(30),
    signup: new RateLimiter(num(process.env.SIGNUP_LIMIT_PER_HOUR, 10), 3_600_000),
    upload: new RateLimiter(120, 3_600_000), // 회원별 시간당 이미지 업로드
    loginGuard: new LoginGuard(),
  };
}

export function getLimits() {
  g.__ebookLimits ??= createLimits();
  return g.__ebookLimits;
}
