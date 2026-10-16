"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Image as ImageIcon, Layers, Loader2, Lock, MousePointerClick, Type, UploadCloud } from "lucide-react";
import { BOOK_TYPE_INFO, composeImageBook, getThemePreset, sizeForAspect } from "@ebook/layouts";
import { api, ApiError } from "@/lib/api";
import { firstPageSize, MAX_PDF_PAGES, openPdf, pdfExtras, renderPdfPages } from "@/lib/import/pdf";
import type { PdfTextBox } from "@/lib/import/pdf-text";
import { installTextMeasurer } from "@/lib/measure";
import { uploadBlob } from "@/lib/upload";
import { alertDialog } from "@/lib/dialog";

// "PDF 그대로 플립북" — FlipHTML5의 기본 기능. 각 쪽을 이미지로 그려 올리고, 원본 비율 그대로 책을 만든다.
// 변환은 브라우저에서 하므로 PDF 파일 자체는 서버에 남지 않는다.

const UPLOAD_CONCURRENCY = 3;

export function PdfToFlipbook({ title }: { title: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const stop = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [error, setError] = useState("");
  // image: 쪽을 그림으로 그대로 / text: 글자를 빼고 그 자리에 고칠 수 있는 글 블록을 올린다
  const [mode, setMode] = useState<"image" | "text">("image");

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
      const textBoxes: (PdfTextBox[] | undefined)[] = new Array(total);
      if (mode === "text") await installTextMeasurer(); // 자간을 웹 글꼴로 재기 전에 글꼴을 받아 둔다
      const pending = new Set<Promise<void>>();
      let done = 0;
      setProgress({ done: 0, total, label: "페이지 변환 중…" });

      await renderPdfPages(
        doc,
        Math.min(2400, size.width * 2),
        async (blob, i, texts) => {
          textBoxes[i] = texts;
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
        { editableText: mode === "text" },
      );
      await Promise.all(pending);
      if (!stop.current) setProgress({ done: total, total, label: "링크·목차·글 읽는 중…" });
      const extras = stop.current ? null : await pdfExtras(doc).catch(() => null);
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
        texts: extras?.texts,
        links: extras?.links,
        toc: extras?.outline,
        textBoxes: mode === "text" ? textBoxes : undefined,
      });
      const { id } = await api<{ id: string }>("/api/books", { body: { doc: book } });
      if (doc.numPages > MAX_PDF_PAGES) await alertDialog(`PDF가 ${doc.numPages}쪽이라 앞의 ${MAX_PDF_PAGES}쪽까지만 가져왔어요.`);
      router.push(`/books/${id}/edit`);
    } catch (e) {
      setProgress(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : "PDF를 변환하지 못했어요.");
    }
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (!f) return;
          if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") return setError("PDF 파일만 올릴 수 있어요.");
          void convert(f);
        }}
        className={`group relative flex min-h-[380px] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-brand-500 bg-brand-50" : "border-black/10 bg-white hover:border-brand-300 hover:bg-brand-50/30"
        }`}
      >
        <div aria-hidden className="dot-grid absolute inset-0 opacity-60" />
        <span className={`relative grid size-16 place-items-center rounded-2xl shadow-lift transition ${dragging ? "scale-110 bg-brand-600 text-white" : "bg-white text-brand-600 ring-1 ring-black/5 group-hover:-translate-y-1"}`}>
          <UploadCloud className="size-7" />
        </span>
        <div className="relative">
          <p className="text-xl font-semibold">PDF를 여기에 끌어다 놓으세요</p>
          <p className="muted mt-1.5 text-sm">또는 눌러서 파일 고르기 · 최대 {MAX_PDF_PAGES}쪽</p>
        </div>
        <span className="btn-primary relative mt-2">
          <FileUp className="size-4" /> PDF 고르기
        </span>
        {error && <p className="banner-error relative mt-2">{error}</p>}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void convert(f);
            e.target.value = "";
          }}
        />
      </label>

      <aside className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-3">
          <p className="px-1 text-sm font-semibold">가져오는 방식</p>
          {(
            [
              ["image", ImageIcon, "원본 그대로", "디자인·글꼴을 그대로 이미지로. 가장 정확해요."],
              ["text", Type, "글자 고칠 수 있게 (베타)", "PDF 글자를 글 블록으로 바꿔 에디터에서 바로 고쳐요. 글꼴은 비슷한 웹 글꼴로 바뀌어요."],
            ] as const
          ).map(([m, Icon, t, d]) => (
            <button
              key={m}
              type="button"
              disabled={!!progress}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex gap-3 rounded-xl border p-3 text-left transition ${mode === m ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/15" : "border-black/10 hover:border-black/20"}`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${mode === m ? "text-brand-600" : "text-neutral-400"}`} />
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="muted mt-0.5 block text-[12.5px] leading-relaxed">{d}</span>
              </span>
            </button>
          ))}
          {mode === "text" && <p className="px-1 text-xs text-neutral-500">스캔한 PDF처럼 글자가 그림인 쪽은 원본 그대로 들어가요.</p>}
        </div>
        {[
          { icon: Layers, title: "페이지 그대로", desc: "디자인·글꼴·사진을 손대지 않고 원본 그대로 플립북 페이지로 바꿔요." },
          { icon: MousePointerClick, title: "그 위에 덧붙이기", desc: "만든 뒤 에디터에서 링크·글·이미지를 페이지 위에 얹을 수 있어요." },
          { icon: Lock, title: "파일은 내 브라우저에서", desc: "PDF는 브라우저 안에서 변환하고, 원본 파일은 서버에 올리지 않아요." },
        ].map((f) => (
          <div key={f.title} className="flex gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="size-4.5" /></span>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="muted mt-0.5 text-[13px] leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </aside>

      {progress && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="card flex w-full max-w-sm flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Loader2 className="size-5 animate-spin" /></span>
              <div>
                <p className="font-semibold">{progress.label}</p>
                <p className="muted text-sm tabular-nums">{progress.total ? `${progress.done} / ${progress.total}쪽` : "잠시만요…"}</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
            <button type="button" className="btn self-end" onClick={() => (stop.current = true)}>그만두기</button>
          </div>
        </div>
      )}
    </div>
  );
}
