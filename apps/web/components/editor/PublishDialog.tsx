"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { confirmDialog } from "@/lib/dialog";

// 퍼블리시·공유 (SPEC 10): 지금 편집본을 공개본으로 복사 → 주소·QR·임베드 코드

export type Publication = { slug: string; visibility: string; publishedAt: number } | null;

export function PublishDialog({
  bookId,
  publication,
  setPublication,
  hasUnpublishedChanges,
  beforePublish,
  onClose,
}: {
  bookId: string;
  publication: Publication;
  setPublication: (p: Publication) => void;
  hasUnpublishedChanges: boolean;
  beforePublish: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");
  const [visibility, setVisibility] = useState(publication?.visibility ?? "public");
  const [password, setPassword] = useState("");
  const [accessMsg, setAccessMsg] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = publication ? `${origin}/b/${publication.slug}` : "";
  const embed = publication
    ? `<iframe src="${origin}/embed/${publication.slug}" width="100%" height="600" style="border:0" allowfullscreen></iframe>`
    : "";

  useEffect(() => {
    if (!url) return setQr("");
    let cancelled = false;
    import("qrcode").then((QR) => QR.toDataURL(url, { width: 480, margin: 1 })).then((d) => !cancelled && setQr(d));
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function publish() {
    setBusy(true);
    setError("");
    try {
      if (!(await beforePublish())) throw new Error("저장하지 못해 퍼블리시를 멈췄어요. 잠시 후 다시 시도해 주세요.");
      const r = await api<{ publication: Publication }>(`/api/books/${bookId}/publish`, { method: "POST" });
      setPublication(r.publication);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "퍼블리시하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!(await confirmDialog("공개를 중지하면 지금 주소로 더는 볼 수 없어요. 다시 퍼블리시하면 새 주소가 만들어집니다.", { title: "공개를 중지할까요?", confirmText: "공개 중지", danger: true }))) return;
    setBusy(true);
    try {
      await api(`/api/books/${bookId}/publish`, { method: "DELETE" });
      setPublication(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccess() {
    setBusy(true);
    setError("");
    setAccessMsg("");
    try {
      const r = await api<{ publication: Publication }>(`/api/books/${bookId}/publish`, { method: "PATCH", body: { visibility, password } });
      setPublication(r.publication);
      setPassword("");
      setAccessMsg("저장했어요");
      setTimeout(() => setAccessMsg(""), 2000);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onPointerDown={onClose}>
      <div className="card flex w-full max-w-lg flex-col gap-5" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-modal aria-labelledby="publish-title">
        <div className="flex items-center justify-between">
          <h2 id="publish-title" className="text-lg font-bold">퍼블리시·공유</h2>
          <button type="button" className="text-neutral-500 hover:text-neutral-900" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {!publication ? (
          <>
            <p className="text-sm text-neutral-600">
              지금 내용을 플립북으로 공개하고 주소를 만들어요. 주소를 아는 사람은 로그인 없이 볼 수 있어요.
              퍼블리시한 뒤에 고친 내용은 <b>다시 퍼블리시</b>해야 공개본에 반영됩니다.
            </p>
            <button type="button" className="btn-primary" disabled={busy} onClick={publish}>{busy ? "퍼블리시 중…" : "퍼블리시"}</button>
          </>
        ) : (
          <>
            {hasUnpublishedChanges ? (
              <div className="banner-warn flex items-center justify-between gap-3">
                <span>퍼블리시 뒤에 고친 내용이 있어요.</span>
                <button type="button" className="btn shrink-0" disabled={busy} onClick={publish}>{busy ? "반영 중…" : "공개본 업데이트"}</button>
              </div>
            ) : (
              <div className="banner-ok">공개 중 · {fmtDate(publication.publishedAt)} 퍼블리시</div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">공유 주소</span>
              <div className="flex gap-2">
                <input className="input text-sm" readOnly value={url} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn shrink-0" onClick={() => copy(url, "url")}>{copied === "url" ? "복사됨" : "복사"}</button>
                <a className="btn shrink-0" href={url} target="_blank" rel="noreferrer">열기</a>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-3 ring-1 ring-black/5">
              <span className="text-sm font-medium">공개 범위</span>
              <div className="seg flex">
                {([
                  ["public", "전체 공개"],
                  ["unlisted", "링크가 있는 사람만"],
                  ["password", "비밀번호"],
                ] as const).map(([v, l]) => (
                  <button key={v} type="button" className="flex-1" aria-pressed={visibility === v} onClick={() => setVisibility(v)}>{l}</button>
                ))}
              </div>
              <p className="text-xs text-neutral-500">
                {visibility === "public" && "누구나 볼 수 있고, 내 책장과 검색엔진에도 노출돼요."}
                {visibility === "unlisted" && "주소를 아는 사람만 볼 수 있어요. 책장·검색엔진에는 나오지 않아요."}
                {visibility === "password" && "비밀번호를 입력해야 볼 수 있어요."}
              </p>
              {visibility === "password" && (
                <input
                  className="input text-sm"
                  type="password"
                  autoComplete="new-password"
                  placeholder={publication.visibility === "password" ? "바꾸려면 새 비밀번호 입력 (비우면 그대로)" : "비밀번호 (4자 이상)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <div className="flex items-center justify-end gap-2">
                {accessMsg && <span className="text-xs text-emerald-600">{accessMsg}</span>}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || (visibility === publication.visibility && !password)}
                  onClick={saveAccess}
                >
                  공개 범위 저장
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              {qr && (
                <div className="flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="공유 주소 QR 코드" className="size-32 rounded-lg ring-1 ring-black/10" />
                  <a className="text-xs text-neutral-600 underline" href={qr} download={`qr-${publication.slug}.png`}>QR 저장</a>
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">홈페이지에 넣기 (임베드)</span>
                <textarea className="input h-24 resize-none font-mono text-xs" readOnly value={embed} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn self-start" onClick={() => copy(embed, "embed")}>{copied === "embed" ? "복사됨" : "코드 복사"}</button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
              <a className="btn" href={`/books/${bookId}/stats`}>방문 통계 보기</a>
              <button type="button" className="btn-danger" disabled={busy} onClick={unpublish}>공개 중지</button>
            </div>
          </>
        )}
        {error && <div className="banner-error">{error}</div>}
      </div>
    </div>
  );
}
