import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// 회원·세션·감사 로그·책·크레딧 (SQLite). 다른 프로젝트(AI-TTS 등)와 같은 구조.
// 운영 규모가 커지면 SPEC 13대로 PostgreSQL로 옮긴다 — SQL은 거의 그대로 쓸 수 있게 짰다.

export const USER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserRole = "user" | "admin";

export type UserRow = {
  id: number;
  username: string;
  name: string;
  pw_hash: string;
  role: UserRole;
  status: UserStatus;
  signup_note: string | null;
  reject_reason: string | null;
  approved_by: number | null;
  approved_at: number | null;
  last_login_at: number | null;
  created_at: number;
};

export type CreditReason = "monthly_grant" | "generate" | "refund" | "purchase" | "admin_adjust" | "signup_grant";

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- 로그인 아이디 (예전 가입자는 이메일 형태 그대로)
    name           TEXT NOT NULL,
    pw_hash        TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'user',      -- user / admin
    status         TEXT NOT NULL DEFAULT 'pending',   -- pending / approved / rejected / suspended
    signup_note    TEXT,
    reject_reason  TEXT,
    approved_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at    INTEGER,
    last_login_at  INTEGER,
    created_at     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_status ON users (status, id);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,                     -- 토큰 원문은 저장하지 않는다 (SHA-256)
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent  TEXT,
    ip          TEXT,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,
    target_type  TEXT,
    target_id    TEXT,
    detail       TEXT,                                 -- JSON
    ip           TEXT,
    created_at   INTEGER NOT NULL
  );

  -- SPEC 13
  CREATE TABLE IF NOT EXISTS books (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL,                         -- draft_outline / generating / ready / failed
    doc         TEXT NOT NULL,                         -- Book JSON
    version     INTEGER NOT NULL DEFAULT 1,
    cover_url   TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_books_user ON books (user_id, updated_at);

  CREATE TABLE IF NOT EXISTS publications (
    id             TEXT PRIMARY KEY,
    book_id        TEXT REFERENCES books(id) ON DELETE CASCADE,
    slug           TEXT NOT NULL UNIQUE,
    visibility     TEXT NOT NULL,                      -- public / unlisted / password
    password_hash  TEXT,
    snapshot       TEXT NOT NULL,
    published_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id           TEXT PRIMARY KEY,
    book_id      TEXT REFERENCES books(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,                        -- outline / generate / export_pdf ...
    status       TEXT NOT NULL,
    progress     TEXT,
    error        TEXT,
    created_at   INTEGER NOT NULL,
    finished_at  INTEGER
  );

  -- 공개본 열람 통계 (뷰어가 보낸다). visitor는 IP·브라우저·날짜로 만든 해시라 사람을 특정하지 않는다
  CREATE TABLE IF NOT EXISTS book_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     TEXT NOT NULL,
    event       TEXT NOT NULL,                          -- view / page / click
    page        INTEGER,
    block_id    TEXT,
    visitor     TEXT,
    referrer    TEXT,
    device      TEXT,                                   -- mobile / desktop
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_book_events ON book_events (book_id, created_at);

  -- 잔액 컬럼 없이 +/- 기록만 쌓는다 (SPEC 12)
  CREATE TABLE IF NOT EXISTS credit_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta       INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    memo        TEXT,
    job_id      TEXT,
    actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_credit_user ON credit_ledger (user_id, id);
`;

export type AuditInput = {
  actorId?: number | null;
  targetType?: string | null;
  targetId?: string | number | null;
  detail?: unknown;
  ip?: string | null;
};

export class Store {
  readonly db: DatabaseSync;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dir, "ebook.sqlite"));
    // 이메일 가입 시절 DB: 컬럼 이름만 바꾸고 값(기존 아이디)은 그대로 둔다
    const cols = this.all<{ name: string }>("SELECT name FROM pragma_table_info('users')").map((c) => c.name);
    if (cols.includes("email") && !cols.includes("username")) this.db.exec("ALTER TABLE users RENAME COLUMN email TO username");
    this.db.exec(SCHEMA);
  }

  get<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }

  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  getUser(id: number) {
    return this.get<UserRow>("SELECT * FROM users WHERE id = ?", id);
  }

  getUserByUsername(username: string) {
    return this.get<UserRow>("SELECT * FROM users WHERE username = ?", username);
  }

  // ── 크레딧 ───────────────────────────────────────────

  creditBalance(userId: number) {
    return this.get<{ n: number | null }>("SELECT SUM(delta) n FROM credit_ledger WHERE user_id = ?", userId)?.n ?? 0;
  }

  addCredit(userId: number, delta: number, reason: CreditReason, { memo = null, jobId = null, actorId = null }: { memo?: string | null; jobId?: string | null; actorId?: number | null } = {}) {
    this.run(
      "INSERT INTO credit_ledger (user_id, delta, reason, memo, job_id, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId, delta, reason, memo, jobId, actorId, Date.now(),
    );
  }

  // ── 감사 로그 ─────────────────────────────────────────

  audit(action: string, { actorId = null, targetType = null, targetId = null, detail = null, ip = null }: AuditInput = {}) {
    this.run(
      "INSERT INTO audit_log (actor_id, action, target_type, target_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      actorId, action, targetType, targetId == null ? null : String(targetId), detail ? JSON.stringify(detail) : null, ip, Date.now(),
    );
  }
}
