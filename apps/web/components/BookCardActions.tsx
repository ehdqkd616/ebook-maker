"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

/** 대시보드 책 카드의 ⋯ 메뉴 — 복제·삭제 */
export function BookCardActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1">
      <button type="button" className="btn px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => api(`/api/books/${id}/duplicate`, { method: "POST" }))}>
        복제
      </button>
      <button
        type="button"
        className="btn-danger px-2 py-1 text-xs"
        disabled={busy}
        onClick={() => confirm(`"${title}"을(를) 삭제할까요? 공개 주소도 함께 사라지고 되돌릴 수 없습니다.`) && run(() => api(`/api/books/${id}`, { method: "DELETE" }))}
      >
        삭제
      </button>
    </div>
  );
}
