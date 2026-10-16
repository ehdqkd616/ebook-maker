"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, X } from "lucide-react";
import { videoEmbedUrl } from "@ebook/renderer";
import { LEAD_FIELD_LABEL, type Block, type LeadField } from "@ebook/schema";
import { PracticePlayer } from "./PracticePlayer";

type ProductData = Extract<Block, { type: "product" }>["data"];
type FormData_ = Extract<Block, { type: "form" }>["data"];
export type PopupContent =
  | { kind: "video"; src: string }
  | { kind: "product"; data: ProductData }
  | { kind: "info"; title?: string; text?: string; image?: string; images?: string[]; video?: string; allowSave?: boolean }
  | { kind: "form"; data: FormData_; blockId: string; page: number }
  | { kind: "player"; data: Extract<Block, { type: "player" }>["data"] };

const safeUrl = (u?: string) => (u && /^(https?:|mailto:|\/)/i.test(u.trim()) ? u.trim() : undefined);

export function ViewerPopup({ content, onClose, slug }: { content: PopupContent; onClose: () => void; slug?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 text-ink backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${content.kind === "video" || content.kind === "player" ? "eb-scroll-dark" : "eb-scroll"} relative max-h-[90dvh] w-full overflow-auto rounded-2xl bg-white shadow-2xl ${content.kind === "video" ? "max-w-4xl bg-black" : content.kind === "player" ? "max-w-4xl bg-[#15131d]" : content.kind === "info" && (content.images?.length || content.image) && !content.video ? "max-w-5xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70">
          <X className="size-5" />
        </button>
        {content.kind === "video" && <Player src={content.src} />}
        {content.kind === "product" && (
          <div>
            {content.data.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.data.image} alt={content.data.name} className="max-h-80 w-full bg-neutral-50 object-contain" />
            )}
            <div className="flex flex-col gap-2 p-6">
              <h3 className="text-xl font-bold">{content.data.name}</h3>
              {content.data.price && <p className="text-2xl font-bold text-brand-600">{content.data.price}</p>}
              {content.data.description && <p className="whitespace-pre-line text-neutral-600">{content.data.description}</p>}
              {safeUrl(content.data.href) && (
                <a href={safeUrl(content.data.href)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-2">
                  {content.data.buttonText || "자세히 보기"} <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </div>
        )}
        {content.kind === "form" && <LeadForm content={content} slug={slug} />}
        {content.kind === "player" && <PracticePlayer data={content.data} />}
        {content.kind === "info" && (
          <div>
            {content.video && <Player src={content.video} />}
            {!content.video && (content.images?.length || content.image) && (
              <Gallery images={content.images?.length ? content.images : [content.image!]} allowSave={!!content.allowSave} title={content.title} />
            )}
            {(content.title || content.text) && (
              <div className="flex flex-col gap-2 p-6">
                {content.title && <h3 className="text-xl font-bold">{content.title}</h3>}
                {content.text && <p className="whitespace-pre-line leading-relaxed text-neutral-700">{content.text}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Player({ src }: { src: string }) {
  const embed = videoEmbedUrl(src);
  return (
    <div className="aspect-video w-full bg-black">
      {embed ? (
        <iframe src={embed} title="동영상" className="size-full" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <video src={src} controls autoPlay playsInline className="size-full" />
      )}
    </div>
  );
}

const INPUT: Record<LeadField, { type: string; autoComplete: string }> = {
  name: { type: "text", autoComplete: "name" },
  email: { type: "email", autoComplete: "email" },
  phone: { type: "tel", autoComplete: "tel" },
  message: { type: "text", autoComplete: "off" },
};

/** 연락처 받기 — 미리보기(slug 없음)에서는 보내지 않고 모양만 보여 준다 */
function LeadForm({ content, slug }: { content: Extract<PopupContent, { kind: "form" }>; slug?: string }) {
  const { data } = content;
  const [values, setValues] = useState<Partial<Record<LeadField, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!slug || slug === "sample") return setState("done");
    setState("sending");
    try {
      const res = await fetch(`/api/public/${slug}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: content.blockId, page: content.page, values }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? "보내지 못했어요.");
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "보내지 못했어요.");
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="text-lg font-semibold">{data.successText || "고맙습니다! 잘 받았어요."}</p>
        {!slug && <p className="text-xs text-neutral-400">미리보기에서는 실제로 보내지 않아요.</p>}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-7">
      <div className="pr-8">
        <h3 className="text-xl font-bold">{data.title}</h3>
        {data.description && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-600">{data.description}</p>}
      </div>
      {data.fields.map((f) => (
        <label key={f} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">{LEAD_FIELD_LABEL[f]}</span>
          {f === "message" ? (
            <textarea className="input min-h-24" required maxLength={2000} value={values[f] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
          ) : (
            <input className="input" required {...INPUT[f]} maxLength={f === "email" ? 200 : 60} value={values[f] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
          )}
        </label>
      ))}
      {error && <p className="banner-error">{error}</p>}
      <button type="submit" className="btn-primary mt-1" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="size-4 animate-spin" />}
        {data.submitText || "보내기"}
      </button>
      <p className="text-center text-[11px] text-neutral-400">보낸 내용은 이 책을 만든 사람만 볼 수 있어요.</p>
    </form>
  );
}

/** 팝업 그림 — 여러 장이면 넘겨 보고, 허용했으면 저장 버튼 */
function Gallery({ images, allowSave, title }: { images: string[]; allowSave: boolean; title?: string }) {
  const [i, setI] = useState(0);
  const src = images[Math.min(i, images.length - 1)];
  const name = `${(title || "그림").replace(/[\\/:*?"<>|]+/g, " ").trim() || "그림"}${images.length > 1 ? `-${i + 1}` : ""}`;
  return (
    <div className="relative bg-neutral-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title ?? ""} className="max-h-[75dvh] w-full object-contain p-2" />
      {images.length > 1 && (
        <>
          <button type="button" aria-label="이전 그림" disabled={i === 0} onClick={() => setI(i - 1)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65 disabled:opacity-0"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="다음 그림" disabled={i === images.length - 1} onClick={() => setI(i + 1)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65 disabled:opacity-0"><ChevronRight className="size-5" /></button>
          <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white tabular-nums">{i + 1} / {images.length}</span>
        </>
      )}
      {allowSave && (
        <div className="flex justify-end border-t border-black/5 bg-white px-3 py-2">
          <a href={src} download={name} className="btn px-3 py-1.5 text-xs">
            <Download className="size-3.5" /> 그림 저장
          </a>
        </div>
      )}
    </div>
  );
}
