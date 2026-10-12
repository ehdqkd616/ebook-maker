"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

const EMPTY = { username: "", name: "", password: "", password2: "", signupNote: "", agreeTerms: false, agreePrivacy: false };

export function SignupForm() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password2) return setError("비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    setError("");
    try {
      const { password2: _, ...body } = form;
      setDone((await api<{ message: string }>("/api/auth/signup", { body })).message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card flex flex-col gap-4">
        <h1 className="text-2xl font-bold">가입 신청 완료</h1>
        <p>{done}</p>
        <p className="muted text-sm">관리자가 승인하면 바로 로그인할 수 있어요.</p>
        <Link href="/login" className="btn-primary">로그인 화면으로</Link>
      </div>
    );
  }

  return (
    <form className="card flex flex-col gap-4" onSubmit={submit}>
      <div>
        <h1 className="text-2xl font-bold">회원가입</h1>
        <p className="muted mt-1 text-sm">가입 후 관리자 승인이 끝나면 이용할 수 있어요.</p>
      </div>
      <label className="field">
        아이디 (영문·숫자·_·- 3~32자)
        <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} required
          pattern="[A-Za-z0-9_\-]{3,32}" minLength={3} maxLength={32} value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
      </label>
      <label className="field">
        이름
        <input className="input" autoComplete="name" required maxLength={50} value={form.name} onChange={set("name")} />
      </label>
      <label className="field">
        비밀번호 (8자 이상)
        <input className="input" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
          value={form.password} onChange={set("password")} />
      </label>
      <label className="field">
        비밀번호 확인
        <input className="input" type="password" autoComplete="new-password" required value={form.password2} onChange={set("password2")} />
      </label>
      <label className="field">
        가입 메모 (선택) — 사용 목적 등을 남기면 승인이 빨라요
        <textarea className="input" rows={3} maxLength={1000} value={form.signupNote} onChange={set("signupNote")} />
      </label>

      <details className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        <summary className="cursor-pointer font-medium text-neutral-800">이용약관 · 개인정보 처리방침 보기</summary>
        <p className="mt-2">
          <b>이용약관</b> — 이 서비스는 입력한 주제나 파일을 바탕으로 AI가 전자책을 만듭니다. 생성된 글과 이미지는 AI 생성물이라 사실과
          다를 수 있으니 공개 전에 확인해야 하며, 공개할 때는 AI 생성물임을 알려야 합니다. 권리가 없는 파일을 올리거나 불법적인 목적으로
          사용할 수 없고, 남용 시 이용이 정지될 수 있습니다. AI 생성에는 크레딧이 차감됩니다.
        </p>
        <p className="mt-2">
          <b>개인정보 처리방침</b> — 수집 항목: 아이디, 이름, 가입 메모, 접속 IP·기기 정보, 입력한 주제·업로드한 파일과 생성된 전자책.
          이용 목적: 회원 관리, 서비스 제공, 남용 방지. 입력 내용은 전자책 생성을 위해 외부 AI 서비스로 전송될 수 있습니다.
          탈퇴를 원하면 관리자에게 요청하세요.
        </p>
      </details>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.agreeTerms} onChange={set("agreeTerms")} /> 이용약관에 동의합니다 (필수)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.agreePrivacy} onChange={set("agreePrivacy")} /> 개인정보 수집·이용에 동의합니다 (필수)
      </label>

      {error && <div className="banner-error" role="alert">{error}</div>}
      <button className="btn-primary" disabled={busy || !form.agreeTerms || !form.agreePrivacy}>
        {busy ? "처리 중…" : "가입 신청"}
      </button>
      <p className="muted text-center text-sm">
        이미 계정이 있나요? <Link href="/login" className="font-medium text-neutral-900 underline">로그인</Link>
      </p>
    </form>
  );
}
