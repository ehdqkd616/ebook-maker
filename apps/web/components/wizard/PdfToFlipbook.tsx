"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BOOK_TYPE_INFO, composeImageBook, getThemePreset, sizeForAspect } from "@ebook/layouts";
import { api, ApiError } from "@/lib/api";
import { firstPageSize, MAX_PDF_PAGES, openPdf, renderPdfPages } from "@/lib/import/pdf";
import { uploadBlob } from "@/lib/upload";

// "PDF 그대로 플립북" — FlipHTML5의 기본 기능. 각 쪽을 이미지로 그려 올리고, 원본 비율 그대로 책을 만든다.
// 변환은 브라우저에서 하므로 PDF 파일 자체는 서버에 남지 않는다.

const UPLOAD_CONCURRENCY = 3;

export function PdfToFlipbook({ title }: { title: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const stop = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [error, setError] = useState("");

  async function convert(file: File) {
    setError("");
    stop.current = false;
    setProgress({ done: 0, total: 0, label: "PDF 여는 중…" });
    try {
      const doc = await openPdf(file);
      const total = Math.min(doc.numPages, MAX_PDF_PAGES);
      const pt = await firstPageSize(doc);
      const size = sizeForAspect(pt.width, pt.height);
      const urls: string[] = new Array(total);
      const pending = new Set<Promise<void>>();
      let done = 0;
      setProgress({ done: 0, total, label: "페이지 변환 중…" });

      await renderPdfPages(
        doc,
        Math.min(2400, size.width * 2),
        async (blob, i) => {
          const task = uploadBlob(blob).then((url) => {
            urls[i] = url;
            done++;
            setProgress({ done, total, label: "페이지 변환 중…" });
          });
          pending.add(task);
          task.finally(() => pending.delete(task)).catch(() => {});
          if (pending.size >= UPLOAD_CONCURRENCY) await Promise.race(pending);
        },
        () => stop.current,
      );
      await Promise.all(pending);
      await doc.loadingTask.destroy();
      if (stop.current) {
        setProgress(null);
        return;
      }

      setProgress({ done: total, total, label: "책 만드는 중…" });
      const name = file.name.replace(/\.pdf$/i, "").slice(0, 100) || "PDF 플립북";
      const book = composeImageBook({
        id: "new",
        title: title.trim() || name,
        bookType: "ebook",
        theme: getThemePreset(BOOK_TYPE_INFO.ebook.theme).theme,
        size,
        images: urls,
      });
      const { id } = await api<{ id: string }>("/api/books", { body: { doc: book } });
      router.push(`/books/${id}/edit`);
      if (doc.numPages > MAX_PDF_PAGES) alert(`앞의 ${MAX_PDF_PAGES}쪽까지만 가져왔어요.`);
    } catch (e) {
      setProgress(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : "PDF를 변환하지 못했어요.");
    }
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="card flex flex-col gap-3 border-neutral-900/10 bg-gradient-to-r from-neutral-900 to-neutral-700 p-5 text-white sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-semibold">이미 만든 PDF가 있나요?</p>
        <p className="mt-1 text-sm text-white/75">
          PDF를 올리면 페이지 그대로 책장 넘기는 플립북으로 바꿔 드려요. 만든 뒤 링크·글·이미지를 더 얹을 수 있어요. (최대 {MAX_PDF_PAGES}쪽, 100MB)
        </p>
        {error && <p className="mt-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-100">{error}</p>}
      </div>
      <button type="button" className="rounded-lg bg-white px-4 py-2.5 font-medium text-neutral-900 hover:bg-neutral-100" onClick={() => inputRef.current?.click()}>
        PDF 올리기
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void convert(f);
          e.target.value = "";
        }}
      />

      {progress && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 text-neutral-900">
          <div className="card flex w-full max-w-sm flex-col gap-4">
            <p className="font-semibold">{progress.label}</p>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="muted text-sm tabular-nums">{progress.total ? `${progress.done} / ${progress.total}쪽` : "잠시만요…"}</p>
            <button type="button" className="btn self-end" onClick={() => (stop.current = true)}>그만두기</button>
          </div>
        </div>
      )}
    </div>
  );
}
