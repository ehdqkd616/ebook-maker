"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  BOOK_TYPE_INFO,
  composeBook,
  getThemePreset,
  splitChapters,
  THEME_PRESETS,
  type ComposeChapter,
} from "@ebook/layouts";
import { BOOK_TYPES, SIZE_PRESETS, type BookType, type SizePreset } from "@ebook/schema";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  FileText,
  FileUp,
  GraduationCap,
  Map as MapIcon,
  Plus,
  ShoppingBag,
  Trash2,
  Upload,
  Wand2, LayoutTemplate, FolderInput } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { PageThumb } from "@/components/PageThumb";
import { TemplateGallery } from "./TemplateGallery";
import { FlipImport } from "./FlipImport";
import { PdfToFlipbook } from "./PdfToFlipbook";
import { api, ApiError } from "@/lib/api";
import { docxToMarkdown } from "@/lib/import/docx";
import { openPdf, pdfToMarkdown } from "@/lib/import/pdf";
import { installTextMeasurer } from "@/lib/measure";

// 새 책 만들기 — ① 종류·크기 ② 디자인 ③ 내용. 오른쪽은 입력하는 대로 바로 조판한 미리보기.

const SIZE_INFO: Record<SizePreset, { label: string; note: string }> = {
  A4: { label: "A4 세로", note: "794 × 1123" },
  LETTER: { label: "레터", note: "816 × 1056" },
  SQUARE: { label: "정사각형", note: "793 × 793" },
  LANDSCAPE: { label: "가로형", note: "1123 × 794" },
};

const STEPS = [
  { label: "종류·크기", hint: "어떤 책인가요?" },
  { label: "디자인", hint: "테마 고르기" },
  { label: "내용", hint: "제목과 원고" },
] as const;

const TYPE_ICON: Record<BookType, typeof BookOpen> = {
  ebook: BookOpen,
  guidebook: MapIcon,
  textbook: GraduationCap,
  brochure: Briefcase,
  catalog: ShoppingBag,
};

type ChapterDraft = ComposeChapter & { key: number };

const EXAMPLE_BODY = `여기에 본문을 붙여 넣으세요. 빈 줄로 문단을 나눕니다.

## 소제목은 이렇게
- 목록은 하이픈으로
- 한 줄에 하나씩

> 인용문은 꺾쇠로 시작합니다.`;

let keySeq = 0;
const draft = (c: Partial<ComposeChapter> = {}): ChapterDraft => ({ key: ++keySeq, title: "", summary: "", body: "", ...c });

export function NewBookWizard({ start }: { start?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pdf" | "design" | "template" | "flip">(start === "pdf" ? "pdf" : start === "template" ? "template" : start === "flip" ? "flip" : "design");
  const [step, setStep] = useState(0);
  const [bookType, setBookType] = useState<BookType>("ebook");
  const [sizePreset, setSizePreset] = useState<SizePreset>("A4");
  const [themeId, setThemeId] = useState(BOOK_TYPE_INFO.ebook.theme);
  const [themeTouched, setThemeTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [chapters, setChapters] = useState<ChapterDraft[]>([draft()]);
  const [openChapter, setOpenChapter] = useState(0);
  const [includeToc, setIncludeToc] = useState(true);
  const [includeBackCover, setIncludeBackCover] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 웹폰트로 글자 폭을 잴 수 있게 되면 미리보기를 다시 조판한다
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    void installTextMeasurer().then(() => setMeasured(true));
  }, []);

  const input = useDeferredValue({ bookType, sizePreset, themeId, title, subtitle, author, chapters, includeToc, includeBackCover, measured });
  const preview = useMemo(
    () =>
      composeBook({
        id: "preview",
        title: input.title.trim() || "책 제목",
        subtitle: input.subtitle.trim() || (input.title.trim() ? "" : "부제를 입력하면 여기에 보여요"),
        author: input.author.trim(),
        bookType: input.bookType,
        sizePreset: input.sizePreset,
        theme: getThemePreset(input.themeId).theme,
        chapters: input.chapters,
        includeToc: input.includeToc,
        includeBackCover: input.includeBackCover,
      }),
    [input],
  );

  const pickType = (t: BookType) => {
    setBookType(t);
    if (!themeTouched) setThemeId(BOOK_TYPE_INFO[t].theme);
  };

  const updateChapter = (i: number, patch: Partial<ComposeChapter>) =>
    setChapters((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const moveChapter = (i: number, d: -1 | 1) =>
    setChapters((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      setOpenChapter(j);
      return next;
    });

  const [importing, setImporting] = useState("");

  /** .txt/.md/.pdf/.docx → 글만 꺼내 챕터로 (`# 제목` 줄마다 챕터) */
  async function importFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const base = file.name.replace(/\.[^.]+$/, "");
    setError("");
    setImporting("파일 읽는 중…");
    try {
      let text: string;
      if (ext === "pdf" || file.type === "application/pdf") {
        const doc = await openPdf(file);
        setImporting(`PDF 글 꺼내는 중… (${doc.numPages}쪽)`);
        text = await pdfToMarkdown(doc);
        await doc.loadingTask.destroy();
        if (!text) throw new Error("PDF에서 글을 찾지 못했어요. 스캔한 PDF라면 위의 \"PDF 그대로\"로 페이지 그대로 만들어 주세요.");
      } else if (ext === "docx") {
        text = await docxToMarkdown(file, setImporting);
      } else if (ext === "doc" || ext === "hwp") {
        throw new Error("이 형식은 바로 읽을 수 없어요. Word에서 .docx 또는 PDF로 저장한 뒤 가져와 주세요.");
      } else {
        if (file.size > 2 * 1024 * 1024) throw new Error("텍스트 파일은 2MB까지 가져올 수 있어요.");
        text = await file.text();
      }
      let imported = splitChapters(text, base);
      if (imported.length === 0) throw new Error("파일에 내용이 없습니다.");
      // 본문 없는 첫 제목은 표지 제목으로 본다 (PDF 표지 등)
      let docTitle = base;
      if (imported.length > 1 && !imported[0].body?.trim()) {
        docTitle = imported[0].title;
        imported = imported.slice(1);
      }
      if (!title.trim()) setTitle(docTitle.slice(0, 100));
      setChapters(imported.map((c) => draft({ ...c, body: c.body?.slice(0, 60_000) })));
      setOpenChapter(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 가져오지 못했어요.");
    } finally {
      setImporting("");
    }
  }

  async function create() {
    if (!title.trim()) {
      setStep(2);
      setError("책 제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // 조판은 실제 글꼴로 글자 폭을 잴 수 있는 브라우저에서 하고, 서버는 검증·저장만 한다
      await installTextMeasurer();
      const doc = composeBook({
        id: "new",
        title: title.trim(),
        subtitle: subtitle.trim(),
        author: author.trim(),
        bookType,
        sizePreset,
        theme: getThemePreset(themeId).theme,
        chapters: chapters.map(({ key: _key, ...c }) => c),
        includeToc,
        includeBackCover,
      });
      const { id } = await api<{ id: string }>("/api/books", { body: { doc } });
      router.push(`/books/${id}/edit`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "책을 만들지 못했습니다.");
      setBusy(false);
    }
  }

  const textChars = chapters.reduce((n, c) => n + (c.body?.length ?? 0), 0);

  const choice = (active: boolean) =>
    `relative rounded-2xl border bg-white text-left transition ${active ? "border-brand-500 ring-4 ring-brand-500/15" : "border-black/[0.08] hover:border-black/20 hover:shadow-soft"}`;
  const check = (active: boolean) =>
    active && <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand-600 text-white"><Check className="size-3" strokeWidth={3} /></span>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">New Book</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">새 책 만들기</h1>
        </div>
        <div className="seg self-start">
          <button type="button" aria-pressed={mode === "template"} onClick={() => setMode("template")} className="flex items-center gap-1.5">
            <LayoutTemplate className="size-4" /> 템플릿
          </button>
          <button type="button" aria-pressed={mode === "pdf"} onClick={() => setMode("pdf")} className="flex items-center gap-1.5">
            <FileUp className="size-4" /> PDF 그대로
          </button>
          <button type="button" aria-pressed={mode === "design"} onClick={() => setMode("design")} className="flex items-center gap-1.5">
            <Wand2 className="size-4" /> 새로 디자인
          </button>
          <button type="button" aria-pressed={mode === "flip"} onClick={() => setMode("flip")} className="flex items-center gap-1.5">
            <FolderInput className="size-4" /> FlipHTML5
          </button>
        </div>
      </div>

      {mode === "flip" ? (
        <div className="mt-8">
          <FlipImport />
        </div>
      ) : mode === "template" ? (
        <div className="mt-8">
          <TemplateGallery />
        </div>
      ) : mode === "pdf" ? (
        <div className="mt-8">
          <PdfToFlipbook title={title} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[176px_minmax(0,1fr)_340px]">
          {/* 단계 */}
          <ol className="flex gap-2 lg:flex-col lg:gap-1">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex-1 lg:flex-none">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${step === i ? "bg-white shadow-soft ring-1 ring-black/[0.06]" : "hover:bg-black/[0.03]"}`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      step === i ? "bg-brand-600 text-white" : step > i ? "bg-brand-100 text-brand-700" : "bg-neutral-200/70 text-neutral-500"
                    }`}
                  >
                    {step > i ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${step === i ? "text-ink" : "text-neutral-600"}`}>{s.label}</span>
                    <span className="hidden text-xs text-neutral-400 lg:block">{s.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <section className="flex min-w-0 flex-col gap-6">
            {step === 0 && (
              <>
                <div>
                  <h2 className="text-lg font-semibold">어떤 책을 만들까요?</h2>
                  <p className="muted mt-1 text-sm">종류에 맞는 테마를 추천해 드려요.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {BOOK_TYPES.map((t) => {
                    const Icon = TYPE_ICON[t];
                    return (
                      <button key={t} type="button" onClick={() => pickType(t)} className={`${choice(bookType === t)} p-4`}>
                        {check(bookType === t)}
                        <span className={`grid size-10 place-items-center rounded-xl ${bookType === t ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                          <Icon className="size-5" />
                        </span>
                        <div className="mt-3 font-semibold">{BOOK_TYPE_INFO[t].label}</div>
                        <div className="muted mt-0.5 text-sm">{BOOK_TYPE_INFO[t].description}</div>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">크기</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((sz) => {
                    const { width, height } = SIZE_PRESETS[sz];
                    const k = 52 / Math.max(width, height);
                    return (
                      <button key={sz} type="button" onClick={() => setSizePreset(sz)} className={`${choice(sizePreset === sz)} flex flex-col items-center gap-2 p-4`}>
                        {check(sizePreset === sz)}
                        <span className="grid h-16 place-items-center">
                          <span
                            className={`block rounded-[3px] border-2 ${sizePreset === sz ? "border-brand-500 bg-brand-50" : "border-neutral-300 bg-neutral-50"}`}
                            style={{ width: width * k, height: height * k }}
                          />
                        </span>
                        <span className="text-sm font-semibold">{SIZE_INFO[sz].label}</span>
                        <span className="text-xs text-neutral-400 tabular-nums">{SIZE_INFO[sz].note}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <h2 className="text-lg font-semibold">테마를 골라 주세요</h2>
                  <p className="muted mt-1 text-sm">색과 글꼴은 에디터에서 언제든 바꿀 수 있어요.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setThemeId(p.id);
                        setThemeTouched(true);
                      }}
                      className={`${choice(themeId === p.id)} flex flex-col items-center gap-3 p-4`}
                    >
                      {check(themeId === p.id)}
                      <PageThumb book={{ size: preview.size, theme: p.theme }} page={preview.pages[0]} width={110} className="rounded-[3px] shadow-book !ring-0" />
                      <span className="flex w-full items-center justify-between">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="flex -space-x-1">
                          {[p.theme.primary, p.theme.secondary].map((c) => (
                            <span key={c} className="size-3.5 rounded-full ring-2 ring-white" style={{ background: c }} />
                          ))}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="card flex flex-col gap-4 p-5">
                  <label className="field">
                    책 제목 <span className="sr-only">(필수)</span>
                    <input className="input text-lg font-semibold" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 처음 배우는 음악 이론" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field">
                      부제
                      <input className="input" maxLength={150} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="표지에 들어갈 한 줄 소개" />
                    </label>
                    <label className="field">
                      지은이
                      <input className="input" maxLength={60} value={author} onChange={(e) => setAuthor(e.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      챕터 <span className="ml-1 text-sm font-normal text-neutral-400">{chapters.length}개 · {textChars.toLocaleString()}자</span>
                    </h2>
                    <div className="flex gap-2">
                      <button type="button" className="btn" disabled={!!importing} onClick={() => fileRef.current?.click()}>
                        <Upload className="size-4" /> {importing || "파일에서 글 가져오기"}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void importFile(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                  <p className="flex items-start gap-2 rounded-xl bg-brand-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-brand-900/80">
                    <FileText className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      PDF·Word(.docx)·텍스트에서 글만 꺼내 새로 디자인해요. 큰 제목마다 챕터로 나눠요. 원래 디자인을 그대로 쓰려면 위의 <b>PDF 그대로</b>를 고르세요.
                    </span>
                  </p>

                  <ul className="flex flex-col gap-2">
                    {chapters.map((c, i) => (
                      <li key={c.key} className={`overflow-hidden rounded-2xl border bg-white transition ${openChapter === i ? "border-black/10 shadow-soft" : "border-black/[0.06]"}`}>
                        <div className="flex items-center gap-2 p-2 pl-3">
                          <span className="w-7 shrink-0 text-xs font-bold text-brand-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <input
                            className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-[15px] font-medium outline-none placeholder:text-neutral-400 focus:bg-neutral-50"
                            placeholder={`${i + 1}장 제목`}
                            maxLength={100}
                            value={c.title}
                            onChange={(e) => updateChapter(i, { title: e.target.value })}
                            onFocus={() => setOpenChapter(i)}
                          />
                          <button type="button" className="icon-btn size-8" aria-label="위로" disabled={i === 0} onClick={() => moveChapter(i, -1)}><ArrowUp className="size-4" /></button>
                          <button type="button" className="icon-btn size-8" aria-label="아래로" disabled={i === chapters.length - 1} onClick={() => moveChapter(i, 1)}><ArrowDown className="size-4" /></button>
                          <button type="button" className="icon-btn size-8 hover:text-red-600" aria-label="챕터 삭제" onClick={() => setChapters((cs) => cs.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
                          <button type="button" className="icon-btn size-8" aria-label={openChapter === i ? "접기" : "본문 펼치기"} onClick={() => setOpenChapter(openChapter === i ? -1 : i)}>
                            <ChevronDown className={`size-4 transition ${openChapter === i ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {openChapter === i && (
                          <div className="flex flex-col gap-3 border-t border-black/[0.05] bg-neutral-50/60 p-3">
                            <input
                              className="input"
                              placeholder="요약 (선택) — 챕터 시작 페이지에 들어가요"
                              maxLength={300}
                              value={c.summary ?? ""}
                              onChange={(e) => updateChapter(i, { summary: e.target.value })}
                            />
                            <textarea
                              className="input min-h-60 text-[15px] leading-relaxed"
                              placeholder={EXAMPLE_BODY}
                              value={c.body ?? ""}
                              onChange={(e) => updateChapter(i, { body: e.target.value })}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-black/15 py-3 text-sm font-medium text-neutral-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700"
                    onClick={() => {
                      setChapters((cs) => [...cs, draft()]);
                      setOpenChapter(chapters.length);
                    }}
                  >
                    <Plus className="size-4" /> 챕터 추가
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ["목차 페이지", includeToc, setIncludeToc] as const,
                    ["뒷표지", includeBackCover, setIncludeBackCover] as const,
                  ].map(([label, on, set]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => set(!on)}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-brand-200 bg-brand-50 text-brand-700" : "border-black/10 bg-white text-neutral-500"}`}
                    >
                      <span className={`grid size-4 place-items-center rounded-full ${on ? "bg-brand-600 text-white" : "bg-neutral-200"}`}>{on && <Check className="size-2.5" strokeWidth={4} />}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <div className="banner-error" role="alert">{error}</div>}

            <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] pt-5">
              <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
                <ArrowLeft className="size-4" /> 이전
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" className="btn-primary" onClick={() => setStep((n) => n + 1)}>
                  다음 <ArrowRight className="size-4" />
                </button>
              ) : (
                <button type="button" className="btn-primary px-6" disabled={busy} onClick={create}>
                  {busy ? "만드는 중…" : "책 만들기"} {!busy && <Wand2 className="size-4" />}
                </button>
              )}
            </div>
          </section>

          {/* 미리보기 */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-soft">
              <div className="flex items-center justify-between px-5 pt-4">
                <span className="text-sm font-semibold">미리보기</span>
                <span className="chip">{preview.pages.length}쪽</span>
              </div>
              <div className="dot-grid m-4 grid place-items-center rounded-2xl bg-neutral-100 py-8">
                <BookCover book={preview} width={sizePreset === "LANDSCAPE" ? 250 : 180} />
              </div>
              <div className="flex gap-2 overflow-x-auto px-4 pb-4">
                {preview.pages.slice(1, 13).map((p, i) => (
                  <PageThumb key={p.id} book={preview} page={p} index={i + 1} width={64} className="shrink-0 rounded-[2px]" />
                ))}
                {preview.pages.length > 13 && <span className="self-center px-2 text-xs text-neutral-400">+{preview.pages.length - 13}</span>}
              </div>
            </div>
            <p className="mt-3 px-2 text-xs leading-relaxed text-neutral-400">본문이 길면 페이지를 자동으로 나눠요. 글자 위치는 만든 뒤 에디터에서 조정할 수 있어요.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
