"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CREDIT_REASON, fmtDate } from "@/lib/format";

type Me = {
  user: { username: string; name: string; role: string; createdAt: number; lastLoginAt: number | null };
  creditBalance: number;
  passwordManaged: boolean;
  credits: { id: number; delta: number; reason: string; memo: string | null; createdAt: number }[];
};

export function MyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe, (e) => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="banner-error">{error}</div></div>;
  if (!me) return <p className="muted mx-auto max-w-3xl px-4 py-10">불러오는 중…</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">내 정보</h1>
      <section className="card grid gap-3 sm:grid-cols-2">
        <Info label="아이디" value={me.user.username} />
        <Info label="이름" value={me.user.name} />
        <Info label="가입일" value={fmtDate(me.user.createdAt)} />
        <Info label="최근 로그인" value={fmtDate(me.user.lastLoginAt)} />
        <Info label="보유 크레딧" value={me.creditBalance.toLocaleString()} />
        <Info label="권한" value={me.user.role === "admin" ? "관리자" : "회원"} />
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">크레딧 내역</h2>
        {me.credits.length === 0 ? (
          <p className="muted text-sm">내역이 없습니다.</p>
        ) : (
          <table className="grid-table">
            <thead><tr><th>일시</th><th>내용</th><th className="text-right">크레딧</th></tr></thead>
            <tbody>
              {me.credits.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                  <td>{CREDIT_REASON[c.reason] ?? c.reason}{c.memo && <span className="muted"> · {c.memo}</span>}</td>
                  <td className={`text-right tabular-nums ${c.delta > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {c.delta > 0 ? "+" : ""}{c.delta.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {me.passwordManaged ? (
        <div className="card muted text-sm">관리자 비밀번호는 서버 .env의 ADMIN_PASSWORD로 관리합니다.</div>
      ) : (
        <PasswordForm />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", newPassword2: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.newPassword2) return setMsg({ ok: false, text: "새 비밀번호 확인이 일치하지 않습니다." });
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/auth/password", { method: "PATCH", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: "", newPassword: "", newPassword2: "" });
      setMsg({ ok: true, text: "비밀번호를 바꿨습니다. 다른 기기에서는 로그아웃되었어요." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={submit}>
      <h2 className="font-semibold">비밀번호 변경</h2>
      <label className="field">
        현재 비밀번호
        <input className="input" type="password" autoComplete="current-password" required value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </label>
      <label className="field">
        새 비밀번호 (8자 이상)
        <input className="input" type="password" autoComplete="new-password" required minLength={8} value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      </label>
      <label className="field">
        새 비밀번호 확인
        <input className="input" type="password" autoComplete="new-password" required value={form.newPassword2}
          onChange={(e) => setForm({ ...form, newPassword2: e.target.value })} />
      </label>
      {msg && <div className={msg.ok ? "banner-ok" : "banner-error"}>{msg.text}</div>}
      <button className="btn-primary self-start" disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</button>
    </form>
  );
}
