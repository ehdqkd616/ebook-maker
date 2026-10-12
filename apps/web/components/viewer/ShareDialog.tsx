"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, Share2, X } from "lucide-react";

// 공유: 주소(지금 쪽부터 열기 선택), QR, SNS, 기기 공유, 홈페이지 임베드 코드

export function ShareDialog({ slug, title, page, onClose }: { slug: string; title: string; page: number; onClose: () => void }) {
  const [fromPage, setFromPage] = useState(false);
  const [copied, setCopied] = useState("");
  const [qr, setQr] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/b/${slug}${fromPage && page > 1 ? `?page=${page}` : ""}`;
  const embed = `<iframe src="${origin}/embed/${slug}${fromPage && page > 1 ? `?page=${page}` : ""}" width="100%" height="600" style="border:0" allowfullscreen></iframe>`;

  useEffect(() => {
    let off = false;
    import("qrcode").then((Q) => Q.toDataURL(url, { width: 360, margin: 1 })).then((d) => !off && setQr(d));
    return () => {
      off = true;
    };
  }, [url]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };
  const enc = encodeURIComponent;
  const socials = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, bg: "#1877f2" },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`, bg: "#000" },
    { name: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}`, bg: "#06c755" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, bg: "#0a66c2" },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 text-ink backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="공유">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">공유하기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="icon-btn"><X className="size-5" /></button>
        </div>
        <div className="flex gap-2">
          <input readOnly value={url} className="input text-sm" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn-primary shrink-0 py-2 text-sm" onClick={() => copy(url, "url")}>
            {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />} {copied === "url" ? "복사됨" : "복사"}
          </button>
        </div>
        {page > 1 && (
          <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" className="accent-brand-600" checked={fromPage} onChange={(e) => setFromPage(e.target.checked)} /> 지금 보는 {page}쪽부터 열리게
          </label>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {socials.map((s) => (
            <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ background: s.bg }}>
              {s.name}
            </a>
          ))}
          <a href={`mailto:?subject=${enc(title)}&body=${enc(url)}`} className="btn"><Mail className="size-4" /> 메일</a>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" className="btn" onClick={() => void navigator.share({ title, url }).catch(() => {})}>
              <Share2 className="size-4" /> 카카오톡 등
            </button>
          )}
        </div>
        <div className="mt-5 flex gap-4">
          {qr && (
            <div className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR 코드" className="size-28 rounded-lg ring-1 ring-black/10" />
              <a href={qr} download={`qr-${slug}.png`} className="text-xs text-neutral-500 underline">QR 저장</a>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">홈페이지에 넣기</span>
            <textarea readOnly value={embed} className="input h-20 resize-none font-mono text-[11px]" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn self-start py-1 text-xs" onClick={() => copy(embed, "embed")}>{copied === "embed" ? "복사됨" : "코드 복사"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
