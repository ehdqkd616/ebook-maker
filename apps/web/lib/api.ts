// 브라우저 → API 호출. 오류는 ApiError로 던진다.

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number, public reason?: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body === undefined ? "GET" : "POST");
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(e.message ?? `요청 실패 (${res.status})`, e.code ?? "UNKNOWN", res.status, e.reason);
  }
  return data as T;
}
