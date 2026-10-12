"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export function PasswordGate({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(120%_80%_at_50%_0%,#3b3550,#16141f_70%)] p-4">
      <form
        className="card flex w-full max-w-sm flex-col gap-4 p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/api/public/${slug}/unlock`, { body: { password: pw } });
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "열지 못했어요.");
            setBusy(false);
          }
        }}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Lock className="size-5" /></span>
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="muted mt-1 text-sm">비밀번호를 아는 사람만 볼 수 있는 책이에요.</p>
        </div>
        <input className="input" type="password" autoFocus placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
        {error && <p className="banner-error">{error}</p>}
        <button className="btn-primary" disabled={busy || !pw}>{busy ? "확인 중…" : "열기"}</button>
      </form>
    </div>
  );
}
