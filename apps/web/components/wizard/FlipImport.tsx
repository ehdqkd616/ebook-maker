"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileArchive, FolderOpen, Loader2, Music2, MousePointerClick, ListTree } from "lucide-react";
import { BOOK_TYPE_INFO, getThemePreset } from "@ebook/layouts";
import { api, ApiError } from "@/lib/api";
import { convertFlipHtml5, flipBook, type FlipReport } from "@/lib/import/fliphtml5";
import { readZip } from "@/lib/import/unzip";
import { uploadBlob } from "@/lib/upload";

// FlipHTML5에서 "HTML로 내려받기"한 책 폴더(또는 zip)를 그대로 옮겨 온다 — 쪽·목차·검색·링크·팝업·음악까지

const MIME: Record<string, string> = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm",
};
const CONCURRENCY = 4;

type Entry = { path: string; blob: () => Promise<Blob> };

/** 고른 파일 목록에서 책 폴더(files/pageEditor.js가 있는 곳)를 찾아 그 기준 경로로 */
function rooted(entries: Entry[]): Map<string, Entry["blob"]> {
  const editor = entries.find((e) => /(^|\/)files\/pageEditor\.js$/.test(e.path));
  if (!editor) throw new Error("FlipHTML5 책 폴더가 아니에요. files/pageEditor.js가 들어 있는 폴더(또는 zip)를 골라 주세요.");
  const prefix = editor.path.slice(0, editor.path.length - "files/pageEditor.js".length);
  return new Map(entries.filter((e) => e.path.startsWith(prefix)).map((e) => [e.path.slice(prefix.length), e.blob]));
}

export function FlipImport() {
  const router = useRouter();
  const [progress, setProgress] = useState<{ label: string; done: number; total: number; files: number } | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<FlipReport | null>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  async function run(entries: Entry[]) {
    setError("");
    setReport(null);
    setProgress({ label: "책 폴더 읽는 중…", done: 0, total: 0, files: 0 });
    try {
      const fs = rooted(entries);
      let running = 0;
      const queue: (() => void)[] = [];
      let files = 0;
      const limit = async <T,>(job: () => Promise<T>) => {
        if (running >= CONCURRENCY) await new Promise<void>((r) => queue.push(r));
        running++;
        try {
          return await job();
        } finally {
          running--;
          queue.shift()?.();
        }
      };
      const { book, report } = await convertFlipHtml5(
        {
          text: async (p) => (fs.has(p) ? (await fs.get(p)!()).text() : null),
          exists: (p) => fs.has(p),
          upload: (p) =>
            limit(async () => {
              const raw = await fs.get(p)!();
              const ext = p.split(".").pop()!.toLowerCase();
              const blob = new Blob([raw], { type: MIME[ext] ?? raw.type });
              if (!MIME[ext]) return null;
              const url = await uploadBlob(blob);
              files++;
              setProgress((s) => (s ? { ...s, files } : s));
              return url;
            }),
        },
        (done, total, label) => setProgress((s) => ({ label, done, total, files: s?.files ?? files })),
      );
      setReport(report);
      setProgress((s) => (s ? { ...s, label: "저장하는 중…" } : s));
      const doc = flipBook(book, getThemePreset(BOOK_TYPE_INFO.textbook.theme).theme);
      const { id } = await api<{ id: string }>("/api/books", { body: { doc } });
      router.push(`/books/${id}/edit`);
    } catch (e) {
      setProgress(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : "가져오지 못했어요.");
    }
  }

  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative flex min-h-[340px] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-dashed border-black/10 bg-white p-10 text-center">
        <div aria-hidden className="dot-grid absolute inset-0 opacity-60" />
        {progress ? (
          <div className="relative flex w-full max-w-sm flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-brand-600" />
            <p className="font-semibold">{progress.label}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-neutral-500 tabular-nums">{progress.total ? `${progress.done}/${progress.total}쪽 · ` : ""}올린 파일 {progress.files}개</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <p className="text-xl font-semibold">FlipHTML5 책을 그대로 옮겨 와요</p>
              <p className="muted mt-1.5 text-sm">FlipHTML5에서 내려받은 책 폴더(index.html과 files 폴더가 있는 곳)나 그 zip 파일을 고르세요.</p>
            </div>
            <div className="relative flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => folderRef.current?.click()}><FolderOpen className="size-4" /> 폴더 고르기</button>
              <label className="btn cursor-pointer">
                <FileArchive className="size-4" /> zip 고르기
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const list = await readZip(f);
                      await run(list.map((z) => ({ path: z.name, blob: z.blob })));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "zip을 읽지 못했어요.");
                    }
                  }}
                />
              </label>
            </div>
            <input
              ref={folderRef}
              type="file"
              className="sr-only"
              multiple
              // 폴더 통째로 고르기 (크롬·엣지·사파리·파이어폭스)
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void run(files.map((f) => ({ path: f.webkitRelativePath || f.name, blob: async () => f })));
              }}
            />
          </>
        )}
        {error && <p className="banner-error relative">{error}</p>}
        {report && !progress && (
          <p className="relative text-sm text-neutral-500">{report.pages}쪽 · 링크 {report.links} · 아이콘 {report.icons} · 플레이어 {report.players}</p>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        {[
          { icon: ListTree, title: "쪽·목차·검색 그대로", desc: "쪽 그림과 목차(북마크), 쪽마다의 글을 옮겨 검색도 바로 돼요." },
          { icon: MousePointerClick, title: "링크·팝업까지", desc: "쪽 이동·웹·전화 링크, 활동지 그림 팝업(저장 허용 포함), YouTube 영상 팝업을 그대로 살려요." },
          { icon: Music2, title: "악보 영상 플레이어", desc: "세광 교과서의 노래·반주·성부 트랙과 절·구간 버튼을 연습 플레이어로 바꿔요. 재생 속도·구간 반복도 더했어요." },
        ].map((f) => (
          <div key={f.title} className="flex gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="size-4.5" /></span>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="muted mt-0.5 text-[13px] leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
        <p className="px-1 text-xs text-neutral-400">파일은 브라우저에서 읽고, 쪽 그림·팝업 그림·음원만 올려요. 한 권에 수백 개를 올리므로 몇 분 걸릴 수 있어요.</p>
      </aside>
    </div>
  );
}
