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
import { PageThumb } from "@/components/PageThumb";
import { api, ApiError } from "@/lib/api";
import { installTextMeasurer } from "@/lib/measure";

// 새 책 만들기 — ① 종류·크기 ② 디자인 ③ 내용. 오른쪽은 입력하는 대로 바로 조판한 미리보기.

const SIZE_INFO: Record<SizePreset, { label: string; note: string }> = {
  A4: { label: "A4 세로", note: "794 × 1123" },
  LETTER: { label: "레터", note: "816 × 1056" },
  SQUARE: { label: "정사각형", note: "793 × 793" },
  LANDSCAPE: { label: "가로형", note: "1123 × 794" },
};

const STEPS = ["종류·크기", "디자인", "내용"] as const;

type ChapterDraft = ComposeChapter & { key: number };

const EXAMPLE_BODY = `여기에 본문을 붙여 넣으세요. 빈 줄로 문단을 나눕니다.

## 소제목은 이렇게
- 목록은 하이픈으로
- 한 줄에 하나씩

> 인용문은 꺾쇠로 시작합니다.`;

let keySeq = 0;
const draft = (c: Partial<ComposeChapter> = {}): ChapterDraft => ({ key: ++keySeq, title: "", summary: "", body: "", ...c });

export function NewBookWizard() {
  const router = useRouter();
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

  async function importFile(file: File) {
    if (file.size > 2 * 1024 * 1024) return setError("가져올 파일은 2MB까지 가능합니다.");
    const text = await file.text();
    const base = file.name.replace(/\.[^.]+$/, "");
    const imported = splitChapters(text, base);
    if (imported.length === 0) return setError("파일에 내용이 없습니다.");
    setError("");
    if (!title.trim()) setTitle(base.slice(0, 100));
    setChapters(imported.map((c) => draft(c)));
    setOpenChapter(0);
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

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-w-0 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">새 책 만들기</h1>
          <p className="muted mt-1 text-sm">글을 넣으면 표지·목차·본문 페이지를 자동으로 짜 드려요. 만든 뒤 에디터에서 자유롭게 고칠 수 있어요.</p>
        </div>

        <ol className="flex gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                  step === i ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${step === i ? "bg-white text-neutral-900" : "bg-neutral-100"}`}>
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="card flex flex-col gap-6">
          {step === 0 && (
            <>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 font-semibold">책 종류</legend>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {BOOK_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => pickType(t)}
                      className={`rounded-xl border p-4 text-left transition ${bookType === t ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"}`}
                    >
                      <div className="font-semibold">{BOOK_TYPE_INFO[t].label}</div>
                      <div className="muted mt-1 text-sm">{BOOK_TYPE_INFO[t].description}</div>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-3 font-semibold">크기</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((s) => {
                    const { width, height } = SIZE_PRESETS[s];
                    const k = 56 / Math.max(width, height);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSizePreset(s)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${sizePreset === s ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"}`}
                      >
                        <span className="grid h-16 place-items-center">
                          <span className="block rounded-sm border-2 border-neutral-400 bg-neutral-50" style={{ width: width * k, height: height * k }} />
                        </span>
                        <span className="text-sm font-medium">{SIZE_INFO[s].label}</span>
                        <span className="muted text-xs">{SIZE_INFO[s].note}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="mb-3 font-semibold">테마</legend>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setThemeId(p.id);
                      setThemeTouched(true);
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${themeId === p.id ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"}`}
                  >
                    <PageThumb book={{ size: preview.size, theme: p.theme }} page={preview.pages[0]} width={120} />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="flex gap-1">
                      {[p.theme.primary, p.theme.secondary, p.theme.background].map((c) => (
                        <span key={c} className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <p className="muted mt-4 text-sm">색과 글꼴은 에디터에서 언제든 바꿀 수 있어요.</p>
            </fieldset>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  책 제목 *
                  <input className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 처음 배우는 음악 이론" />
                </label>
                <label className="field">
                  부제
                  <input className="input" maxLength={150} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="표지에 들어갈 한 줄 소개" />
                </label>
                <label className="field">
                  지은이
                  <input className="input" maxLength={60} value={author} onChange={(e) => setAuthor(e.target.value)} />
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">챕터 <span className="muted text-sm font-normal">({chapters.length}개 · 본문 {textChars.toLocaleString()}자)</span></h2>
                  <div className="flex gap-2">
                    <button type="button" className="btn" onClick={() => fileRef.current?.click()}>텍스트 파일 가져오기</button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".txt,.md,.markdown,text/plain,text/markdown"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importFile(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setChapters((cs) => [...cs, draft()]);
                        setOpenChapter(chapters.length);
                      }}
                    >
                      + 챕터 추가
                    </button>
                  </div>
                </div>
                <p className="muted text-xs">.txt/.md 파일은 <code># 제목</code> 줄마다 챕터로 나눠 가져와요. 챕터를 비워 두면 표지만 있는 빈 책으로 시작합니다.</p>

                <ul className="flex flex-col gap-2">
                  {chapters.map((c, i) => (
                    <li key={c.key} className="rounded-xl border border-neutral-200">
                      <div className="flex items-center gap-2 p-2 pl-3">
                        <span className="muted w-8 shrink-0 text-xs font-semibold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <input
                          className="input py-1.5"
                          placeholder={`${i + 1}장 제목`}
                          maxLength={100}
                          value={c.title}
                          onChange={(e) => updateChapter(i, { title: e.target.value })}
                          onFocus={() => setOpenChapter(i)}
                        />
                        <button type="button" className="btn px-2" aria-label="위로" disabled={i === 0} onClick={() => moveChapter(i, -1)}>↑</button>
                        <button type="button" className="btn px-2" aria-label="아래로" disabled={i === chapters.length - 1} onClick={() => moveChapter(i, 1)}>↓</button>
                        <button type="button" className="btn px-2" onClick={() => setOpenChapter(openChapter === i ? -1 : i)}>
                          {openChapter === i ? "접기" : "본문"}
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-2"
                          aria-label="챕터 삭제"
                          onClick={() => setChapters((cs) => cs.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      </div>
                      {openChapter === i && (
                        <div className="flex flex-col gap-3 border-t border-neutral-100 p-3">
                          <label className="field">
                            요약 (챕터 시작 페이지에 들어가요)
                            <input className="input" maxLength={300} value={c.summary ?? ""} onChange={(e) => updateChapter(i, { summary: e.target.value })} />
                          </label>
                          <label className="field">
                            본문
                            <textarea
                              className="input min-h-56 text-sm leading-relaxed"
                              placeholder={EXAMPLE_BODY}
                              value={c.body ?? ""}
                              onChange={(e) => updateChapter(i, { body: e.target.value })}
                            />
                          </label>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={includeToc} onChange={(e) => setIncludeToc(e.target.checked)} /> 목차 페이지</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={includeBackCover} onChange={(e) => setIncludeBackCover(e.target.checked)} /> 뒷표지</label>
              </div>
            </>
          )}

          {error && <div className="banner-error" role="alert">{error}</div>}

          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
            <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← 이전</button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>다음 →</button>
            ) : (
              <button type="button" className="btn-primary" disabled={busy} onClick={create}>{busy ? "만드는 중…" : "책 만들기"}</button>
            )}
          </div>
        </div>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">미리보기</h2>
            <span className="muted text-sm">{preview.pages.length}쪽</span>
          </div>
          <div className="grid place-items-center rounded-xl bg-neutral-100 p-4">
            <PageThumb book={preview} page={preview.pages[0]} width={sizePreset === "LANDSCAPE" ? 300 : 220} className="shadow-lg" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {preview.pages.slice(1, 13).map((p, i) => (
              <PageThumb key={p.id} book={preview} page={p} index={i + 1} width={72} className="shrink-0" />
            ))}
            {preview.pages.length > 13 && <span className="muted self-center px-2 text-xs">+{preview.pages.length - 13}쪽</span>}
          </div>
          <p className="muted text-xs">본문이 길면 페이지를 자동으로 나눠요. 실제 글자 위치는 에디터에서 조정할 수 있어요.</p>
        </div>
      </aside>
    </div>
  );
}
