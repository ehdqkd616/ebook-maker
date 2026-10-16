"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CREDIT_REASON, fmtDate, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { AdminUser } from "@/lib/server/admin";
import { confirmDialog, promptDialog } from "@/lib/dialog";

export type AdminTab = "dashboard" | "users" | "books" | "audit";

const TABS: [AdminTab, string][] = [
  ["dashboard", "대시보드"],
  ["users", "회원 관리"],
  ["books", "책 목록"],
  ["audit", "감사 로그"],
];

export function AdminPanel({ initialTab, initialStatus, currentUserId }: { initialTab: AdminTab; initialStatus: string; currentUserId: number }) {
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState(initialStatus);

  const go = (next: AdminTab, nextStatus = "") => {
    setTab(next);
    setStatus(nextStatus);
    const qs = new URLSearchParams({ tab: next, ...(nextStatus ? { status: nextStatus } : {}) });
    window.history.replaceState(null, "", `/admin?${qs}`);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => go(k)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard onGoPending={() => go("users", "pending")} />}
      {tab === "users" && <Users key={status} initialStatus={status} currentUserId={currentUserId} />}
      {tab === "books" && <Books />}
      {tab === "audit" && <Audit />}
    </div>
  );
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    fn().then((d) => (setData(d), setError("")), (e) => setError(e.message));
  }, deps);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

const Loading = () => <p className="muted text-sm">불러오는 중…</p>;
const Empty = ({ children = "기록이 없습니다." }: { children?: React.ReactNode }) => <p className="muted py-4 text-sm">{children}</p>;

// ── 대시보드 ─────────────────────────────────────────

type Stats = {
  users: { total: number; pending: number; byStatus: Record<string, number> };
  today: { signups: number; logins: number; loginFailures: number };
  books: { total: number };
  week: { date: string; signups: number; logins: number; books: number }[];
};

function Dashboard({ onGoPending }: { onGoPending: () => void }) {
  const { data, error } = useLoad(() => api<Stats>("/api/admin/stats"), []);
  if (error) return <div className="banner-error">{error}</div>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={onGoPending}
          className={`card text-left transition hover:shadow-md ${data.users.pending ? "border-amber-300 bg-amber-50" : ""}`}
        >
          <div className="muted text-sm">승인 대기</div>
          <div className="mt-1 text-3xl font-bold">{data.users.pending}</div>
          <div className="muted mt-1 text-xs">눌러서 승인하기 →</div>
        </button>
        <Tile label="전체 회원" value={data.users.total}
          sub={`승인 ${data.users.byStatus.approved ?? 0} · 정지 ${data.users.byStatus.suspended ?? 0} · 거절 ${data.users.byStatus.rejected ?? 0}`} />
        <Tile label="오늘 로그인" value={data.today.logins} sub={`실패 ${data.today.loginFailures} · 가입 ${data.today.signups}`} />
        <Tile label="전체 책" value={data.books.total} />
      </div>
      <section className="card">
        <h2 className="mb-3 font-semibold">최근 7일</h2>
        <table className="grid-table">
          <thead><tr><th>날짜</th><th className="text-right">가입</th><th className="text-right">로그인</th><th className="text-right">새 책</th></tr></thead>
          <tbody>
            {data.week.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td className="text-right tabular-nums">{d.signups}</td>
                <td className="text-right tabular-nums">{d.logins}</td>
                <td className="text-right tabular-nums">{d.books}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <div className="muted text-sm">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value.toLocaleString()}</div>
      {sub && <div className="muted mt-1 text-xs">{sub}</div>}
    </div>
  );
}

// ── 회원 관리 ─────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? ""}`}>
      {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
    </span>
  );
}

function Users({ initialStatus, currentUserId }: { initialStatus: string; currentUserId: number }) {
  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const { data, error, reload } = useLoad(
    () => api<{ items: AdminUser[] }>(`/api/admin/users?${new URLSearchParams({ status, q: query })}`),
    [status, query],
  );

  const act = async (fn: () => Promise<unknown>, okText?: string) => {
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ ok: true, text: okText });
      setSelected(new Set());
      reload();
      router.refresh(); // 헤더의 승인 대기 배지 갱신
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const post = (u: AdminUser, action: string, body: object = {}) => api(`/api/admin/users/${u.id}/${action}`, { body });

  const pendingIds = data?.items.filter((u) => u.status === "pending").map((u) => u.id) ?? [];
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {([["", "전체"], ...Object.entries(STATUS_LABEL)] as [string, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatus(k)}
              className={`rounded-full px-3 py-1 text-sm ${status === k ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <form className="ml-auto w-full sm:w-64" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <input className="input py-1.5 text-sm" placeholder="아이디·이름 검색 (Enter)" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      {pendingIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox"
              checked={pendingIds.every((id) => selected.has(id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(pendingIds) : new Set())} />
            승인 대기 전체 선택
          </label>
          <button type="button" className="btn" disabled={!selected.size}
            onClick={() => act(() => api("/api/admin/users/bulk-approve", { body: { userIds: [...selected] } }), `${selected.size}명을 승인했습니다.`)}>
            선택한 {selected.size}명 승인
          </button>
        </div>
      )}

      {msg && <div className={msg.ok ? "banner-ok" : "banner-error"}>{msg.text}</div>}
      {error && <div className="banner-error">{error}</div>}
      {!data ? <Loading /> : data.items.length === 0 ? <Empty>회원이 없습니다.</Empty> : (
        <div className="overflow-x-auto">
          <table className="grid-table min-w-[760px]">
            <thead>
              <tr><th className="w-8" /><th>회원</th><th>상태</th><th className="text-right">크레딧</th><th>가입</th><th>최근 로그인</th><th>관리</th></tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <UserRows key={u.id} u={u} open={openId === u.id} self={u.id === currentUserId}
                  checked={selected.has(u.id)} onCheck={() => toggle(u.id)}
                  onToggleOpen={() => setOpenId(openId === u.id ? null : u.id)}
                  onApprove={() => act(() => post(u, "approve"), `${u.name} 님을 승인했습니다.`)}
                  onReject={async () => {
                    const reason = await promptDialog("사유는 선택이고, 회원에게 표시돼요.", { title: `${u.name} 님의 가입을 거절할까요?`, placeholder: "거절 사유 (선택)", confirmText: "거절", danger: true });
                    if (reason !== null) act(() => post(u, "reject", { reason }), `${u.name} 님의 가입을 거절했습니다.`);
                  }}
                  onSuspend={async () => (await confirmDialog("정지하면 즉시 로그아웃돼요.", { title: `${u.name} 님을 정지할까요?`, confirmText: "정지", danger: true })) && act(() => post(u, "suspend"), `${u.name} 님을 정지했습니다.`)}
                  onUnsuspend={() => act(() => post(u, "unsuspend"), `${u.name} 님의 정지를 해제했습니다.`)}
                  onTempPassword={async () => {
                    if (!(await confirmDialog("기존 세션은 모두 종료돼요.", { title: `${u.name} 님의 비밀번호를 임시 비밀번호로 바꿀까요?`, confirmText: "바꾸기", danger: true }))) return;
                    act(async () => {
                      const { tempPassword } = await post(u, "temp-password") as { tempPassword: string };
                      setMsg({ ok: true, text: `임시 비밀번호: ${tempPassword}  (지금 한 번만 표시됩니다. 회원에게 전달하세요.)` });
                    });
                  }}
                  onCredits={async () => {
                    const raw = await promptDialog("회수는 음수로 입력하세요. 예: 500 / -200", { title: `${u.name} 님 크레딧 지급`, placeholder: "크레딧", confirmText: "다음" });
                    if (!raw) return;
                    const delta = Number(raw);
                    if (!Number.isInteger(delta) || delta === 0) return setMsg({ ok: false, text: "0이 아닌 정수를 입력하세요." });
                    const memo = (await promptDialog("관리 기록에 남아요.", { title: "메모 (선택)", placeholder: "메모", confirmText: "지급" }));
                    if (memo === null) return;
                    act(() => post(u, "credits", { delta, memo }), `${u.name} 님 크레딧 ${delta > 0 ? "+" : ""}${delta}`);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type RowProps = {
  u: AdminUser; open: boolean; self: boolean; checked: boolean;
  onCheck: () => void; onToggleOpen: () => void; onApprove: () => void; onReject: () => void;
  onSuspend: () => void; onUnsuspend: () => void; onTempPassword: () => void; onCredits: () => void;
};

function UserRows({ u, open, self, checked, ...on }: RowProps) {
  return (
    <>
      <tr className={u.status === "pending" ? "bg-amber-50/50" : ""}>
        <td>{u.status === "pending" && <input type="checkbox" checked={checked} onChange={on.onCheck} aria-label={`${u.name} 선택`} />}</td>
        <td>
          <button type="button" className="text-left hover:underline" onClick={on.onToggleOpen}>
            <span className="font-medium">{u.name}</span>
            {u.role === "admin" && <span className="ml-1 rounded bg-indigo-100 px-1.5 text-xs text-indigo-700">관리자</span>}
            <div className="muted text-xs">{u.username}</div>
          </button>
          {u.signupNote && <div className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-neutral-600">메모: {u.signupNote}</div>}
          {u.rejectReason && <div className="mt-1 text-xs text-red-700">거절 사유: {u.rejectReason}</div>}
        </td>
        <td><StatusBadge status={u.status} /></td>
        <td className="text-right tabular-nums">{u.creditBalance.toLocaleString()}</td>
        <td className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
        <td className="whitespace-nowrap">{fmtDate(u.lastLoginAt)}</td>
        <td>
          {self ? <span className="muted text-xs">본인</span> : (
            <div className="flex flex-wrap gap-1">
              {(u.status === "pending" || u.status === "rejected") && <button type="button" className="btn" onClick={on.onApprove}>승인</button>}
              {u.status === "pending" && <button type="button" className="btn-danger" onClick={on.onReject}>거절</button>}
              {u.status === "approved" && u.role !== "admin" && <button type="button" className="btn-danger" onClick={on.onSuspend}>정지</button>}
              {u.status === "suspended" && <button type="button" className="btn" onClick={on.onUnsuspend}>정지 해제</button>}
              <button type="button" className="btn" onClick={on.onCredits}>크레딧</button>
              <button type="button" className="btn" onClick={on.onTempPassword}>임시 비번</button>
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td />
          <td colSpan={6}><UserDetail id={u.id} /></td>
        </tr>
      )}
    </>
  );
}

type Detail = {
  logins: { action: string; ip: string; createdAt: number }[];
  credits: { id: number; delta: number; reason: string; memo: string | null; createdAt: number; actorUsername: string | null }[];
  books: { id: string; title: string; status: string; updatedAt: number }[];
};

function UserDetail({ id }: { id: number }) {
  const { data, error } = useLoad(() => api<Detail>(`/api/admin/users/${id}`), [id]);
  if (error) return <div className="banner-error">{error}</div>;
  if (!data) return <Loading />;
  const LOGIN_LABEL: Record<string, string> = { "login.success": "성공", "login.failure": "실패", "login.blocked": "차단" };
  return (
    <div className="grid gap-4 rounded-lg bg-neutral-50 p-3 md:grid-cols-3">
      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-500">최근 로그인</h3>
        {data.logins.length === 0 ? <Empty /> : data.logins.map((l, i) => (
          <div key={i} className="text-xs">{fmtDate(l.createdAt)} · {LOGIN_LABEL[l.action] ?? l.action} · <span className="muted">{l.ip}</span></div>
        ))}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-500">크레딧 내역</h3>
        {data.credits.length === 0 ? <Empty /> : data.credits.map((c) => (
          <div key={c.id} className="text-xs">
            {fmtDate(c.createdAt)} · {CREDIT_REASON[c.reason] ?? c.reason} <b className="tabular-nums">{c.delta > 0 ? "+" : ""}{c.delta}</b>
            {c.memo && <span className="muted"> · {c.memo}</span>}
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-500">책</h3>
        {data.books.length === 0 ? <Empty /> : data.books.map((b) => (
          <div key={b.id} className="text-xs">{b.title} · <span className="muted">{b.status}</span></div>
        ))}
      </div>
    </div>
  );
}

// ── 책 목록 ──────────────────────────────────────────

type BookItem = { id: string; title: string; status: string; version: number; updatedAt: number; userUsername: string | null; userName: string | null };

function Books() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error } = useLoad(() => api<{ items: BookItem[] }>(`/api/admin/books?${new URLSearchParams({ q: query })}`), [query]);
  return (
    <section className="card flex flex-col gap-4">
      <form className="sm:w-64" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <input className="input py-1.5 text-sm" placeholder="제목·아이디 검색 (Enter)" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {error && <div className="banner-error">{error}</div>}
      {!data ? <Loading /> : data.items.length === 0 ? <Empty>아직 만들어진 책이 없습니다.</Empty> : (
        <table className="grid-table">
          <thead><tr><th>제목</th><th>만든 사람</th><th>상태</th><th>수정</th></tr></thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.title}</td>
                <td>{b.userName} <span className="muted text-xs">{b.userUsername}</span></td>
                <td>{b.status}</td>
                <td className="whitespace-nowrap">{fmtDate(b.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── 감사 로그 ─────────────────────────────────────────

type AuditItem = { id: number; action: string; targetType: string | null; targetId: string | null; detail: unknown; ip: string | null; createdAt: number; actorUsername: string | null };

const AUDIT_FILTERS: [string, string][] = [["", "전체"], ["user.", "회원"], ["login.", "로그인"], ["admin.", "관리자 조치"]];

function Audit() {
  const [action, setAction] = useState("");
  const { data, error } = useLoad(() => api<{ items: AuditItem[] }>(`/api/admin/audit?${new URLSearchParams({ action })}`), [action]);
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {AUDIT_FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setAction(k)}
            className={`rounded-full px-3 py-1 text-sm ${action === k ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <div className="banner-error">{error}</div>}
      {!data ? <Loading /> : data.items.length === 0 ? <Empty /> : (
        <div className="overflow-x-auto">
          <table className="grid-table min-w-[720px]">
            <thead><tr><th>일시</th><th>동작</th><th>수행자</th><th>대상</th><th>내용</th><th>IP</th></tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td>{a.actorUsername ?? "-"}</td>
                  <td>{a.targetType ? `${a.targetType}#${a.targetId}` : "-"}</td>
                  <td className="max-w-xs break-all font-mono text-xs">{a.detail ? JSON.stringify(a.detail) : ""}</td>
                  <td className="text-xs">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
