"use client";

import { ExternalLink, X } from "lucide-react";
import { videoEmbedUrl } from "@ebook/renderer";
import type { Block } from "@ebook/schema";

type ProductData = Extract<Block, { type: "product" }>["data"];
export type PopupContent =
  | { kind: "video"; src: string }
  | { kind: "product"; data: ProductData }
  | { kind: "info"; title?: string; text?: string; image?: string; video?: string };

const safeUrl = (u?: string) => (u && /^(https?:|mailto:|\/)/i.test(u.trim()) ? u.trim() : undefined);

export function ViewerPopup({ content, onClose }: { content: PopupContent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 text-ink backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative max-h-[90dvh] w-full overflow-auto rounded-2xl bg-white shadow-2xl ${content.kind === "video" ? "max-w-4xl bg-black" : "max-w-lg"}`}
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
        {content.kind === "info" && (
          <div>
            {content.video && <Player src={content.video} />}
            {!content.video && content.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.image} alt="" className="max-h-[60dvh] w-full bg-neutral-50 object-contain" />
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
