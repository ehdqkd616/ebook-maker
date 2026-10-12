export const STATUS_LABEL = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
  suspended: "정지됨",
} as const;

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-neutral-200 text-neutral-700",
};

export const CREDIT_REASON: Record<string, string> = {
  signup_grant: "가입 승인 지급",
  monthly_grant: "월 지급",
  generate: "전자책 생성",
  refund: "환불",
  purchase: "충전",
  admin_adjust: "관리자 조정",
};

export function fmtDate(ms: number | null | undefined) {
  if (!ms) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(ms));
}

/** 로그인 후 돌아갈 주소 — 같은 사이트 경로만 허용 (오픈 리다이렉트 방지) */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
