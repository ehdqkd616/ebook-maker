import { createHash } from "node:crypto";
import { getStore } from "./store";

// 공개본 열람 통계 — 뷰어가 /api/track으로 보낸 이벤트를 쌓고, 책 주인이 /books/:id/stats에서 본다.
// 방문자는 IP·브라우저·날짜를 섞은 해시로만 구분한다 (하루가 지나면 같은 사람도 다른 값).

export function visitorId(ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
}

export function recordEvent(e: { bookId: string; event: "view" | "page" | "click"; page?: number | null; blockId?: string | null; visitor: string; referrer?: string | null; device: string }) {
  getStore().run(
    "INSERT INTO book_events (book_id, event, page, block_id, visitor, referrer, device, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    e.bookId, e.event, e.page ?? null, e.blockId ?? null, e.visitor, e.referrer ?? null, e.device, Date.now(),
  );
}

export function bookStats(bookId: string, days = 30) {
  const store = getStore();
  const since = Date.now() - days * 86_400_000;
  const one = <T>(sql: string, ...p: (string | number)[]) => store.get<T>(sql, ...p);
  const totals = one<{ views: number; visitors: number; pages: number; clicks: number }>(
    `SELECT SUM(event = 'view') views, COUNT(DISTINCT CASE WHEN event = 'view' THEN visitor END) visitors,
            SUM(event = 'page') pages, SUM(event = 'click') clicks
     FROM book_events WHERE book_id = ? AND created_at >= ?`,
    bookId, since,
  ) ?? { views: 0, visitors: 0, pages: 0, clicks: 0 };
  const daily = store.all<{ day: string; views: number; visitors: number }>(
    `SELECT date(created_at / 1000, 'unixepoch', '+9 hours') day, SUM(event = 'view') views,
            COUNT(DISTINCT CASE WHEN event = 'view' THEN visitor END) visitors
     FROM book_events WHERE book_id = ? AND created_at >= ? GROUP BY day ORDER BY day`,
    bookId, since,
  );
  const pages = store.all<{ page: number; views: number }>(
    `SELECT page, COUNT(*) views FROM book_events WHERE book_id = ? AND created_at >= ? AND event = 'page' AND page IS NOT NULL
     GROUP BY page ORDER BY page`,
    bookId, since,
  );
  const clicks = store.all<{ blockId: string; page: number; clicks: number }>(
    `SELECT block_id blockId, MAX(page) page, COUNT(*) clicks FROM book_events
     WHERE book_id = ? AND created_at >= ? AND event = 'click' AND block_id IS NOT NULL GROUP BY block_id ORDER BY clicks DESC LIMIT 20`,
    bookId, since,
  );
  const referrers = store.all<{ host: string; views: number }>(
    `SELECT COALESCE(referrer, '직접 방문') host, COUNT(*) views FROM book_events
     WHERE book_id = ? AND created_at >= ? AND event = 'view' GROUP BY host ORDER BY views DESC LIMIT 10`,
    bookId, since,
  );
  const devices = store.all<{ device: string; views: number }>(
    `SELECT device, COUNT(*) views FROM book_events WHERE book_id = ? AND created_at >= ? AND event = 'view' GROUP BY device`,
    bookId, since,
  );
  // 방문 1번에 몇 쪽을 넘겼는지 (방문자·날짜 기준 대략치)
  const depth = one<{ avg: number | null }>(
    `SELECT AVG(n) avg FROM (SELECT COUNT(DISTINCT page) n FROM book_events WHERE book_id = ? AND created_at >= ? AND event = 'page' GROUP BY visitor)`,
    bookId, since,
  );
  return { days, totals, daily, pages, clicks, referrers, devices, avgPagesPerVisitor: Math.round((depth?.avg ?? 0) * 10) / 10 };
}
