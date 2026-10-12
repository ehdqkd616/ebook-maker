"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: form });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("로그인하지 못했습니다.", "UNKNOWN", 0));
      setBusy(false);
    }
  }

  return (
    <form className="card flex flex-col gap-4" onSubmit={submit}>
      <h1 className="text-2xl font-bold">로그인</h1>
      <label className="field">
        아이디
        <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })} />
      </label>
      <label className="field">
        비밀번호
        <input className="input" type="password" autoComplete="current-password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      {error && (
        <div className={error.code === "ACCOUNT_PENDING" ? "banner-warn" : "banner-error"} role="alert">
          {error.message}
          {error.reason && <div className="mt-1">사유: {error.reason}</div>}
        </div>
      )}
      <button className="btn-primary" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
      <p className="muted text-center text-sm">
        계정이 없나요? <Link href="/signup" className="font-medium text-neutral-900 underline">회원가입</Link>
      </p>
    </form>
  );
}
