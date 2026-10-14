import { LEAD_FIELD_LABEL, LEAD_FIELDS, type LeadField } from "@ebook/schema";
import { getPublished, unlockToken } from "./books";
import { HttpError } from "./http";
import { getStore } from "./store";

// "연락처 받기" 폼 — 공개 플립북 독자가 보낸 내용을 모으고, 책 주인이 보고 CSV로 받는다.

const MAX: Record<LeadField, number> = { name: 60, email: 200, phone: 40, message: 2000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{6,40}$/;

export function saveLead(slug: string, body: unknown, unlockCookie: string | undefined) {
  const pub = getPublished(slug);
  if (!pub) throw new HttpError(404, "책을 찾을 수 없습니다.", "NOT_FOUND");
  if (pub.visibility === "password" && pub.passwordHash && unlockCookie !== unlockToken(slug, pub.passwordHash)) {
    throw new HttpError(403, "비밀번호로 연 다음 보내 주세요.", "LOCKED");
  }
  const { blockId, page, values } = (body ?? {}) as { blockId?: unknown; page?: unknown; values?: Record<string, unknown> };
  const block = pub.book.pages.flatMap((p) => p.blocks).find((b) => b.id === blockId);
  if (!block || block.type !== "form") throw new HttpError(400, "폼을 찾을 수 없습니다.", "BAD_FORM");
  const data: Partial<Record<LeadField, string>> = {};
  for (const f of block.data.fields) {
    const v = typeof values?.[f] === "string" ? (values[f] as string).trim() : "";
    if (!v) throw new HttpError(400, `${LEAD_FIELD_LABEL[f]}을(를) 입력해 주세요.`, "REQUIRED");
    if (v.length > MAX[f]) throw new HttpError(400, `${LEAD_FIELD_LABEL[f]}이(가) 너무 깁니다.`, "TOO_LONG");
    if (f === "email" && !EMAIL_RE.test(v)) throw new HttpError(400, "이메일 주소를 확인해 주세요.", "BAD_EMAIL");
    if (f === "phone" && !PHONE_RE.test(v)) throw new HttpError(400, "전화번호를 확인해 주세요.", "BAD_PHONE");
    data[f] = v;
  }
  const pageNo = Number.isInteger(page) && (page as number) > 0 ? (page as number) : null;
  getStore().run(
    "INSERT INTO book_leads (book_id, block_id, page, data, created_at) VALUES (?, ?, ?, ?, ?)",
    pub.bookId,
    block.id,
    pageNo,
    JSON.stringify(data),
    Date.now(),
  );
}

export type Lead = { id: number; blockId: string; page: number | null; createdAt: number } & Partial<Record<LeadField, string>>;

export function listLeads(bookId: string, limit = 1000): Lead[] {
  return getStore()
    .all<{ id: number; block_id: string; page: number | null; data: string; created_at: number }>(
      "SELECT id, block_id, page, data, created_at FROM book_leads WHERE book_id = ? ORDER BY created_at DESC LIMIT ?",
      bookId,
      limit,
    )
    .map((r) => {
      let d: Record<string, string> = {};
      try {
        d = JSON.parse(r.data);
      } catch {
        /* 깨진 줄은 비워 둔다 */
      }
      return { id: r.id, blockId: r.block_id, page: r.page, createdAt: r.created_at, ...d };
    });
}

/** 엑셀에서 바로 열리게 BOM을 붙인 CSV. 수식으로 해석될 수 있는 값(=,+,-,@로 시작)은 막는다 */
export function leadsCsv(leads: Lead[]): string {
  const cell = (v: unknown) => {
    let s = v === undefined || v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["받은 시각", "쪽", ...LEAD_FIELDS.map((f) => LEAD_FIELD_LABEL[f])];
  const rows = leads.map((l) => [new Date(l.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), l.page ?? "", ...LEAD_FIELDS.map((f) => l[f] ?? "")]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
