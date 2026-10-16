"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { alertDialog, confirmDialog } from "@/lib/dialog";

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
      void alertDialog(e instanceof ApiError ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1">
      <button type="button" className="btn px-2 py-1 text-xs" title="복제" aria-label="복제" disabled={busy} onClick={() => run(() => api(`/api/books/${id}/duplicate`, { method: "POST" }))}>
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        className="btn-danger px-2 py-1 text-xs"
        title="삭제"
        aria-label="삭제"
        disabled={busy}
        onClick={async () => (await confirmDialog(`"${title}"을(를) 삭제합니다. 공개 주소도 함께 사라지고 되돌릴 수 없어요.`, { title: "책을 삭제할까요?", confirmText: "삭제", danger: true })) && run(() => api(`/api/books/${id}`, { method: "DELETE" }))}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
