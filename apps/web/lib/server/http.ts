// 라우트 핸들러 공통: 오류 → JSON, CSRF 검사, 클라이언트 IP

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public extra?: { reason?: string; retryAfter?: number },
  ) {
    super(message);
  }
}

export const bad = (message: string, code = "VALIDATION_ERROR") => new HttpError(400, message, code);

/** 앱은 127.0.0.1에만 바인딩되고 Caddy가 X-Forwarded-For를 클라이언트 IP로 덮어쓴다. */
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
}

export function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https";
}

/**
 * CSRF 방어: 상태를 바꾸는 요청은 JSON 본문만 받고(폼으로는 교차 출처 전송 불가),
 * Origin이 붙어 오면 같은 호스트여야 한다. 세션 쿠키도 SameSite=Strict.
 */
function csrfCheck(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {}
    if (host !== req.headers.get("host")) throw new HttpError(403, "허용되지 않은 요청 출처입니다.", "BAD_ORIGIN");
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "JSON 요청만 허용됩니다.", "UNSUPPORTED_MEDIA_TYPE");
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw bad("요청 본문을 읽을 수 없습니다.", "BAD_JSON");
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    const headers: HeadersInit = err.extra?.retryAfter ? { "Retry-After": String(err.extra.retryAfter) } : {};
    if (err.status === 429) console.warn(`${err.status} ${err.code}`);
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.extra?.reason ? { reason: err.extra.reason } : {}) } },
      { status: err.status, headers },
    );
  }
  console.error(err);
  return Response.json({ error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } }, { status: 500 });
}

/** 핸들러가 객체를 돌려주면 JSON으로, HttpError를 던지면 오류 JSON으로 바꾼다. */
export function route<C = unknown>(handler: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      csrfCheck(req);
      const out = await handler(req, ctx);
      return out instanceof Response ? out : Response.json(out);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
