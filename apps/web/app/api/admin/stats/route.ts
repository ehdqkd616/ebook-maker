import { requireAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

const TODAY = "date(created_at / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')";

export const GET = route(async () => {
  await requireAdmin();
  const store = getStore();
  const byStatus = Object.fromEntries(
    store.all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM users GROUP BY status").map((r) => [r.status, r.n]),
  );
  const count = (sql: string) => store.get<{ n: number }>(sql)?.n ?? 0;
  const week = store.all(
    `SELECT d.date,
       (SELECT COUNT(*) FROM users WHERE date(created_at / 1000, 'unixepoch', 'localtime') = d.date) signups,
       (SELECT COUNT(*) FROM audit_log WHERE action = 'login.success' AND date(created_at / 1000, 'unixepoch', 'localtime') = d.date) logins,
       (SELECT COUNT(*) FROM books WHERE date(created_at / 1000, 'unixepoch', 'localtime') = d.date) books
     FROM (SELECT date('now', 'localtime', '-' || value || ' days') date FROM json_each('[6,5,4,3,2,1,0]')) d`,
  );
  return {
    users: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      pending: byStatus.pending ?? 0,
    },
    today: {
      signups: count(`SELECT COUNT(*) n FROM users WHERE ${TODAY}`),
      logins: count(`SELECT COUNT(*) n FROM audit_log WHERE action = 'login.success' AND ${TODAY}`),
      loginFailures: count(`SELECT COUNT(*) n FROM audit_log WHERE action = 'login.failure' AND ${TODAY}`),
    },
    books: { total: count("SELECT COUNT(*) n FROM books") },
    week,
  };
});
