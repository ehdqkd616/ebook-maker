"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { bookFromTemplate, TEMPLATES, type TemplateDef } from "@ebook/layouts";
import { PageThumb } from "@/components/PageThumb";
import { api, ApiError } from "@/lib/api";

// 템플릿으로 시작하기 — 표지와 첫 펼침을 미리 보여 주고, 고르면 바로 에디터로

const CATEGORIES = ["전체", "읽을거리", "비즈니스", "교육", "행사·홍보"] as const;

export function TemplateGallery() {
  const router = useRouter();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("전체");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // 미리보기용 책은 한 번만 만든다
  const previews = useMemo(() => new Map(TEMPLATES.map((t) => [t.id, bookFromTemplate(t)])), []);
  const list = TEMPLATES.filter((t) => cat === "전체" || t.category === cat);

  async function use(t: TemplateDef) {
    setBusy(t.id);
    setError("");
    try {
      const { id } = await api<{ id: string }>("/api/books", { body: { doc: bookFromTemplate(t) } });
      router.push(`/books/${id}/edit`);
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : "책을 만들지 못했어요.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${cat === c ? "bg-ink text-white" : "bg-white text-neutral-600 ring-1 ring-black/[0.08] hover:text-ink"}`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && <p className="banner-error">{error}</p>}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => {
          const b = previews.get(t.id)!;
          const landscape = b.size.width > b.size.height;
          const w = landscape ? 150 : b.size.width === b.size.height ? 118 : 100;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => use(t)}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
              >
                <div className="relative flex h-52 items-center justify-center gap-0 overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-200/60">
                  <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
                  {/* 표지 + 첫 본문 쪽을 펼친 책처럼 */}
                  <div className="relative flex -rotate-2 shadow-lift transition duration-300 group-hover:rotate-0">
                    <PageThumb book={b} page={b.pages[0]} width={w} className="rounded-l-sm ring-0" />
                    {b.pages[2] && <PageThumb book={b} page={b.pages[2]} width={w} className="hidden rounded-r-sm ring-0 sm:block" />}
                  </div>
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-sm">{t.category}</span>
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.name}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{t.description}</p>
                    <p className="mt-2 text-[11px] text-neutral-400">{b.pages.length}쪽 · {landscape ? "가로형" : b.size.width === b.size.height ? "정사각형" : "세로형"}</p>
                  </div>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                    {busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-neutral-500">템플릿의 글·색·글꼴은 에디터에서 모두 바꿀 수 있어요. 사진 자리는 더블클릭해서 내 사진으로 바꾸세요.</p>
    </div>
  );
}
