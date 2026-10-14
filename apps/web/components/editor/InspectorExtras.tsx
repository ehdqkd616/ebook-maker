"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { videoInfo } from "@ebook/renderer";
import {
  ANIMATIONS,
  LEAD_FIELD_LABEL,
  LEAD_FIELDS,
  DEFAULT_VIEWER,
  ViewerSettings,
  type Block,
  type BlockAction,
  type Book,
  type Page,
} from "@ebook/schema";
import { reorderBlock, setStyle, updateBlock } from "./ops";

// 속성 패널 추가 부분 — 멀티미디어 블록 편집, 동작(클릭 시), 애니메이션, 모양(테두리·그림자),
// 레이어 목록, 뷰어 설정

type Update = (fn: (b: Book) => Book, mergeKey?: string) => void;
const small = "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.06em] text-neutral-400 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-neutral-700">
        {label}
        {hint && <span className="block text-xs text-neutral-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-neutral-300"}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

const toHex6 = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

// ── 멀티미디어 블록 ─────────────────────────────────────

export function MediaSections({
  block,
  set,
  onPickMedia,
  onAddSlides,
  pickImageUrl,
}: {
  block: Block;
  set: (fn: (b: Block) => Block, key?: string) => void;
  onPickMedia: (blockId: string, accept: string) => void;
  onAddSlides: (blockId: string) => void;
  pickImageUrl: () => Promise<string | null>;
}) {
  switch (block.type) {
    case "video": {
      const v = videoInfo(block.data.src);
      return (
        <Section title="동영상">
          <input
            className={small}
            placeholder="YouTube·Vimeo 주소 붙여 넣기"
            value={block.data.src.startsWith("/api/files/") ? "" : block.data.src}
            onChange={(e) => set((b) => (b.type === "video" ? { ...b, data: { ...b.data, src: e.target.value.trim() } } : b), `src:${block.id}`)}
          />
          <button type="button" className="btn" onClick={() => onPickMedia(block.id, "video/mp4,video/webm")}>동영상 파일 올리기 (MP4, 30MB까지)</button>
          <p className="text-xs text-neutral-400">
            {block.data.src ? (v.kind === "file" ? "올린 파일" : v.kind === "youtube" ? "YouTube 동영상" : "Vimeo 동영상") + " · 누르면 크게 재생돼요" : "주소를 넣거나 파일을 올리세요."}
          </p>
        </Section>
      );
    }
    case "audio":
      return (
        <Section title="오디오">
          <input className={small} placeholder="버튼에 보일 제목" value={block.data.title ?? ""} onChange={(e) => set((b) => (b.type === "audio" ? { ...b, data: { ...b.data, title: e.target.value } } : b), `title:${block.id}`)} />
          <button type="button" className="btn" onClick={() => onPickMedia(block.id, "audio/*")}>{block.data.src ? "오디오 바꾸기" : "오디오 올리기"} (MP3 등)</button>
          {block.data.src && <audio src={block.data.src} controls className="w-full" />}
        </Section>
      );
    case "slideshow":
      return (
        <Section title={`슬라이드쇼 · ${block.data.images.length}장`}>
          <div className="grid grid-cols-3 gap-1.5">
            {block.data.images.map((im, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.src} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/40 group-hover:flex">
                  <button type="button" aria-label="앞으로" disabled={i === 0} className="grid size-6 place-items-center rounded bg-white/90 disabled:opacity-30" onClick={() => set((b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, images: swap(b.data.images, i, i - 1) } } : b))}><ArrowUp className="size-3 -rotate-90" /></button>
                  <button type="button" aria-label="빼기" className="grid size-6 place-items-center rounded bg-white/90 text-red-600" onClick={() => set((b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, images: b.data.images.filter((_, j) => j !== i) } } : b))}><Trash2 className="size-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => onAddSlides(block.id)}>사진 추가</button>
          {block.data.images.length > 0 && (
            <input
              className={small}
              placeholder={`${block.data.images.length}번째 사진 설명 (선택)`}
              value={block.data.images.at(-1)?.caption ?? ""}
              onChange={(e) =>
                set((b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, images: b.data.images.map((im, j) => (j === b.data.images.length - 1 ? { ...im, caption: e.target.value || undefined } : im)) } } : b), `cap:${block.id}`)
              }
            />
          )}
          <Row label="자동 넘김">
            <select className={`${small} w-28`} value={block.data.autoplay} onChange={(e) => set((b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, autoplay: Number(e.target.value) } } : b))}>
              <option value={0}>끄기</option>
              {[2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}초마다</option>)}
            </select>
          </Row>
          <Row label="맞춤">
            <select className={`${small} w-28`} value={block.data.fit} onChange={(e) => set((b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, fit: e.target.value as "cover" | "contain" } } : b))}>
              <option value="cover">채우기</option>
              <option value="contain">전체 보이기</option>
            </select>
          </Row>
        </Section>
      );
    case "product":
      return (
        <Section title="상품 태그">
          <p className="text-xs text-neutral-400">페이지 위 동그란 표시를 누르면 상품 카드가 떠요. 사진의 상품 위에 올려 두세요.</p>
          <input className={small} placeholder="상품 이름" value={block.data.name} onChange={(e) => set((b) => (b.type === "product" ? { ...b, data: { ...b.data, name: e.target.value } } : b), `pn:${block.id}`)} />
          <input className={small} placeholder="가격 (예: ₩29,000)" value={block.data.price ?? ""} onChange={(e) => set((b) => (b.type === "product" ? { ...b, data: { ...b.data, price: e.target.value || undefined } } : b), `pp:${block.id}`)} />
          <textarea className={`${small} min-h-20`} placeholder="설명" value={block.data.description ?? ""} onChange={(e) => set((b) => (b.type === "product" ? { ...b, data: { ...b.data, description: e.target.value || undefined } } : b), `pd:${block.id}`)} />
          <input className={small} placeholder="구매 링크 (https://…)" value={block.data.href ?? ""} onChange={(e) => set((b) => (b.type === "product" ? { ...b, data: { ...b.data, href: e.target.value.trim() || undefined } } : b), `ph:${block.id}`)} />
          <input className={small} placeholder="버튼 글자 (기본: 자세히 보기)" value={block.data.buttonText ?? ""} onChange={(e) => set((b) => (b.type === "product" ? { ...b, data: { ...b.data, buttonText: e.target.value || undefined } } : b), `pb:${block.id}`)} />
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const url = await pickImageUrl();
              if (url) set((b) => (b.type === "product" ? { ...b, data: { ...b.data, image: url } } : b));
            }}
          >
            {block.data.image ? "상품 사진 바꾸기" : "상품 사진 넣기"}
          </button>
        </Section>
      );
    case "button":
      return (
        <Section title="버튼">
          <input className={small} value={block.data.text} onChange={(e) => set((b) => (b.type === "button" ? { ...b, data: { ...b.data, text: e.target.value } } : b), `bt:${block.id}`)} />
          <div className="seg flex">
            {(["solid", "outline", "pill"] as const).map((v) => (
              <button key={v} type="button" className="flex-1" aria-pressed={block.data.variant === v} onClick={() => set((b) => (b.type === "button" ? { ...b, data: { ...b.data, variant: v } } : b))}>
                {{ solid: "채움", outline: "테두리", pill: "알약" }[v]}
              </button>
            ))}
          </div>
        </Section>
      );
    case "form": {
      const setForm = (patch: Partial<Extract<Block, { type: "form" }>["data"]>, key?: string) =>
        set((b) => (b.type === "form" ? { ...b, data: { ...b.data, ...patch } } : b), key);
      return (
        <Section title="연락처 받기">
          <p className="text-xs text-neutral-400">독자가 버튼을 누르면 입력 창이 떠요. 보낸 내용은 이 책의 <b>통계</b> 화면에 모이고 CSV로 받을 수 있어요.</p>
          <Row label="버튼 글자"><input className={`${small} w-40`} value={block.data.text} maxLength={80} onChange={(e) => setForm({ text: e.target.value }, `ft:${block.id}`)} /></Row>
          <input className={small} placeholder="창 제목" value={block.data.title} maxLength={120} onChange={(e) => setForm({ title: e.target.value }, `fti:${block.id}`)} />
          <textarea className={`${small} min-h-16`} placeholder="설명 (선택)" value={block.data.description ?? ""} maxLength={1000} onChange={(e) => setForm({ description: e.target.value || undefined }, `fd:${block.id}`)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-neutral-600">받을 항목</span>
            <div className="grid grid-cols-2 gap-1.5">
              {LEAD_FIELDS.map((f) => {
                const on = block.data.fields.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    className={`btn justify-start ${on ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`}
                    onClick={() => {
                      const next = on ? block.data.fields.filter((x) => x !== f) : LEAD_FIELDS.filter((x) => x === f || block.data.fields.includes(x));
                      if (next.length) setForm({ fields: next });
                    }}
                  >
                    {on ? "✓ " : ""}{LEAD_FIELD_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>
          <Row label="보내기 버튼"><input className={`${small} w-40`} value={block.data.submitText ?? ""} placeholder="보내기" maxLength={40} onChange={(e) => setForm({ submitText: e.target.value || undefined }, `fs:${block.id}`)} /></Row>
          <input className={small} placeholder="보낸 뒤 보여 줄 말" value={block.data.successText ?? ""} maxLength={300} onChange={(e) => setForm({ successText: e.target.value || undefined }, `fsu:${block.id}`)} />
        </Section>
      );
    }
    case "paragraph":
      return (
        <Section title="본문 장식">
          <Toggle label="첫 글자 크게 (드롭캡)" checked={!!block.data.dropCap} onChange={(x) => set((b) => (b.type === "paragraph" ? { ...b, data: { ...b.data, dropCap: x || undefined } } : b))} />
        </Section>
      );
    case "hotspot":
      return (
        <Section title="핫스팟">
          <p className="text-xs text-neutral-400">보이지 않는 클릭 영역이에요. PDF 페이지 위 원하는 곳에 올려 두고 아래 "눌렀을 때"를 정하세요.</p>
          <Toggle label="깜빡이는 점 보이기" checked={block.data.pulse} onChange={(v) => set((b) => (b.type === "hotspot" ? { ...b, data: { ...b.data, pulse: v } } : b))} />
        </Section>
      );
    case "embed":
      return (
        <Section title="웹 삽입">
          <input className={small} placeholder="https:// 로 시작하는 주소" value={block.data.url} onChange={(e) => set((b) => (b.type === "embed" ? { ...b, data: { url: e.target.value.trim() } } : b), `eu:${block.id}`)} />
          <p className="text-xs text-neutral-400">구글 지도·설문지, 유튜브 재생목록처럼 다른 사이트를 페이지 안에 보여 줘요. 일부 사이트는 삽입을 막아 둘 수 있어요.</p>
        </Section>
      );
    default:
      return null;
  }
}

function swap<T>(arr: T[], i: number, j: number) {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ── 동작 (눌렀을 때) ───────────────────────────────────

const ACTION_LESS = new Set(["toc", "slideshow", "embed", "link", "audio", "form"]);

export function ActionSection({ block, set, pageCount, pickImageUrl }: { block: Block; set: (fn: (b: Block) => Block, key?: string) => void; pageCount: number; pickImageUrl: () => Promise<string | null> }) {
  if (ACTION_LESS.has(block.type)) return null;
  const a = block.action;
  const kind = a?.type ?? "none";
  const setAction = (next: BlockAction | undefined, key?: string) => set((b) => ({ ...b, action: next }) as Block, key);
  const builtIn = block.type === "video" ? "누르면 동영상 재생" : block.type === "product" ? "누르면 상품 카드" : "아무 동작 없음";
  return (
    <Section title="눌렀을 때">
      <select
        className={small}
        value={kind}
        onChange={(e) => {
          const k = e.target.value;
          setAction(k === "url" ? { type: "url", href: "https://" } : k === "page" ? { type: "page", page: 1 } : k === "popup" ? { type: "popup", title: "", text: "" } : undefined);
        }}
      >
        <option value="none">{builtIn}</option>
        <option value="url">웹 주소 열기</option>
        <option value="page">책의 다른 쪽으로 이동</option>
        <option value="popup">팝업 띄우기 (글·사진·동영상)</option>
      </select>
      {a?.type === "url" && <input className={small} placeholder="https://" value={a.href} onChange={(e) => setAction({ type: "url", href: e.target.value.trim() }, `act:${block.id}`)} />}
      {a?.type === "page" && (
        <Row label="이동할 쪽">
          <input type="number" min={1} max={pageCount} className={`${small} w-24`} value={a.page} onChange={(e) => setAction({ type: "page", page: Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)) }, `act:${block.id}`)} />
        </Row>
      )}
      {a?.type === "popup" && (
        <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-2.5">
          <input className={small} placeholder="제목" value={a.title ?? ""} onChange={(e) => setAction({ ...a, title: e.target.value || undefined }, `act:${block.id}`)} />
          <textarea className={`${small} min-h-20`} placeholder="내용" value={a.text ?? ""} onChange={(e) => setAction({ ...a, text: e.target.value || undefined }, `act:${block.id}`)} />
          <input className={small} placeholder="동영상 주소 (YouTube·Vimeo, 선택)" value={a.video ?? ""} onChange={(e) => setAction({ ...a, video: e.target.value.trim() || undefined }, `act:${block.id}`)} />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn flex-1"
              onClick={async () => {
                const url = await pickImageUrl();
                if (url) setAction({ ...a, image: url });
              }}
            >
              {a.image ? "사진 바꾸기" : "사진 넣기"}
            </button>
            {a.image && <button type="button" className="btn-danger" onClick={() => setAction({ ...a, image: undefined })}>빼기</button>}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── 애니메이션 ─────────────────────────────────────────

const ANIM_LABEL: Record<(typeof ANIMATIONS)[number], string> = {
  fade: "서서히 나타나기",
  "slide-up": "아래에서 올라오기",
  "slide-left": "오른쪽에서 들어오기",
  "slide-right": "왼쪽에서 들어오기",
  zoom: "커지며 나타나기",
  bounce: "통통 튀기",
};

export function AnimationSection({ block, set }: { block: Block; set: (fn: (b: Block) => Block, key?: string) => void }) {
  const a = block.animation;
  return (
    <Section title="등장 애니메이션">
      <select
        className={small}
        value={a?.type ?? ""}
        onChange={(e) => set((b) => ({ ...b, animation: e.target.value ? { type: e.target.value as (typeof ANIMATIONS)[number], delay: a?.delay ?? 0, duration: a?.duration ?? 600 } : undefined }) as Block)}
      >
        <option value="">없음</option>
        {ANIMATIONS.map((t) => <option key={t} value={t}>{ANIM_LABEL[t]}</option>)}
      </select>
      {a && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            시작 지연 (초)
            <input type="number" step={0.1} min={0} max={10} className={small} value={a.delay / 1000} onChange={(e) => set((b) => ({ ...b, animation: { ...a, delay: Math.round(Math.max(0, Math.min(10, Number(e.target.value) || 0)) * 1000) } }) as Block, `anim:${block.id}`)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            길이 (초)
            <input type="number" step={0.1} min={0.1} max={5} className={small} value={a.duration / 1000} onChange={(e) => set((b) => ({ ...b, animation: { ...a, duration: Math.round(Math.max(0.1, Math.min(5, Number(e.target.value) || 0.6)) * 1000) } }) as Block, `anim:${block.id}`)} />
          </label>
        </div>
      )}
      {a && <p className="text-xs text-neutral-400">플립북에서 이 쪽을 펼칠 때 재생돼요. 미리보기로 확인하세요.</p>}
    </Section>
  );
}

// ── 모양 (테두리·그림자·모서리) ─────────────────────────

const SHADOWS = {
  "": "없음",
  "0 2px 8px rgba(0,0,0,.12)": "얕게",
  "0 10px 30px rgba(0,0,0,.18)": "보통",
  "0 24px 60px rgba(0,0,0,.28)": "깊게",
} as const;

export function AppearanceSection({ block, set }: { block: Block; set: (fn: (b: Block) => Block, key?: string) => void }) {
  const st = block.style ?? {};
  const style = (k: string, v: string | number | undefined) => set((b) => setStyle(b, k, v), `style:${block.id}:${k}`);
  const bw = Number(st.borderWidth ?? 0);
  return (
    <Section title="모양">
      <Row label="테두리 두께">
        <input type="range" min={0} max={12} value={bw} onChange={(e) => {
          const w = Number(e.target.value);
          set((b) => setStyle(setStyle(setStyle(b, "borderWidth", w || undefined), "borderStyle", w ? "solid" : undefined), "borderColor", w ? (st.borderColor ?? "#111111") : undefined), `style:${block.id}:bw`);
        }} />
      </Row>
      {bw > 0 && (
        <Row label="테두리 색">
          <input type="color" className="h-8 w-10 cursor-pointer rounded-lg border border-black/10 bg-white p-0.5" value={toHex6(st.borderColor as string, "#111111")} onChange={(e) => style("borderColor", e.target.value)} />
        </Row>
      )}
      <Row label="모서리 둥글게">
        <input type="range" min={0} max={80} value={Number(st.borderRadius ?? 0)} onChange={(e) => style("borderRadius", Number(e.target.value) || undefined)} />
      </Row>
      <Row label="그림자">
        <select className={`${small} w-28`} value={(st.boxShadow as string) ?? ""} onChange={(e) => style("boxShadow", e.target.value || undefined)}>
          {Object.entries(SHADOWS).map(([v, l]) => <option key={l} value={v}>{l}</option>)}
        </select>
      </Row>
      {block.type === "image" && (
        <Row label="필터">
          <select className={`${small} w-28`} value={(st.filter as string) ?? ""} onChange={(e) => style("filter", e.target.value || undefined)}>
            <option value="">원본</option>
            <option value="grayscale(1)">흑백</option>
            <option value="sepia(.8)">세피아</option>
            <option value="saturate(1.5)">선명하게</option>
            <option value="brightness(1.15)">밝게</option>
            <option value="contrast(1.25)">대비 강하게</option>
            <option value="blur(2px)">흐리게</option>
          </select>
        </Row>
      )}
    </Section>
  );
}

// ── 잠금·숨김 ──────────────────────────────────────────

export function LockHide({ block, set }: { block: Block; set: (fn: (b: Block) => Block) => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" className={`btn flex-1 ${block.locked ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`} onClick={() => set((b) => ({ ...b, locked: !b.locked || undefined }) as Block)}>
        {block.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />} {block.locked ? "잠김" : "잠그기"}
      </button>
      <button type="button" className={`btn flex-1 ${block.hidden ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`} onClick={() => set((b) => ({ ...b, hidden: !b.hidden || undefined }) as Block)}>
        {block.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {block.hidden ? "숨김" : "숨기기"}
      </button>
    </div>
  );
}

// ── 레이어 목록 (페이지 탭) ─────────────────────────────

const LAYER_LABEL: Record<Block["type"], string> = {
  heading: "제목", paragraph: "본문", list: "목록", quote: "인용", image: "이미지", shape: "도형", audio: "오디오", video: "동영상",
  link: "링크", toc: "목차", slideshow: "슬라이드쇼", product: "상품", button: "버튼", hotspot: "핫스팟", embed: "웹 삽입", form: "연락처 받기",
};

function layerName(b: Block) {
  const d = b.data as Record<string, unknown>;
  const t = String(d.text ?? d.name ?? d.title ?? d.label ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 24) : LAYER_LABEL[b.type];
}

export function LayersList({ page, selectedId, update, onSelect }: { page: Page; selectedId: string | null; update: Update; onSelect: (id: string) => void }) {
  const layers = [...page.blocks].reverse(); // 위에 그려지는 것부터
  return (
    <Section title={`레이어 · ${page.blocks.length}`}>
      {layers.length === 0 ? (
        <p className="text-xs text-neutral-400">이 쪽에는 블록이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {layers.map((b, k) => (
            <li key={b.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1 ${selectedId === b.id ? "bg-brand-50" : "hover:bg-neutral-50"}`}>
              <button type="button" className={`min-w-0 flex-1 truncate text-left text-[13px] ${b.hidden ? "text-neutral-400 line-through" : ""}`} onClick={() => onSelect(b.id)}>
                <span className="mr-1.5 text-[11px] text-neutral-400">{LAYER_LABEL[b.type]}</span>
                {layerName(b) !== LAYER_LABEL[b.type] && layerName(b)}
              </button>
              <button type="button" aria-label="위로" disabled={k === 0} className="icon-btn size-6 opacity-0 group-hover:opacity-100" onClick={() => update((bk) => reorderBlock(bk, page.id, b.id, "forward"))}><ArrowUp className="size-3.5" /></button>
              <button type="button" aria-label="아래로" disabled={k === layers.length - 1} className="icon-btn size-6 opacity-0 group-hover:opacity-100" onClick={() => update((bk) => reorderBlock(bk, page.id, b.id, "backward"))}><ArrowDown className="size-3.5" /></button>
              <button type="button" aria-label={b.hidden ? "보이기" : "숨기기"} className={`icon-btn size-6 ${b.hidden ? "" : "opacity-0 group-hover:opacity-100"}`} onClick={() => update((bk) => updateBlock(bk, page.id, b.id, (x) => ({ ...x, hidden: !x.hidden || undefined }) as Block))}>
                {b.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button type="button" aria-label={b.locked ? "잠금 풀기" : "잠그기"} className={`icon-btn size-6 ${b.locked ? "text-brand-600" : "opacity-0 group-hover:opacity-100"}`} onClick={() => update((bk) => updateBlock(bk, page.id, b.id, (x) => ({ ...x, locked: !x.locked || undefined }) as Block))}>
                {b.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ── 뷰어 설정 탭 ───────────────────────────────────────

const BUTTON_LABEL: Record<keyof ViewerSettings["buttons"], string> = {
  thumbnails: "썸네일",
  toc: "목차",
  search: "검색",
  zoom: "확대",
  share: "공유",
  fullscreen: "전체 화면",
  bookmarks: "책갈피",
  autoplay: "자동 넘김",
  sound: "소리 켜고 끄기",
  reader: "텍스트로 읽기",
};

export function ViewerPanel({ book, update, pickImageUrl, pickAudioUrl }: { book: Book; update: Update; pickImageUrl: () => Promise<string | null>; pickAudioUrl: () => Promise<string | null> }) {
  const v = ViewerSettings.parse(book.viewer ?? DEFAULT_VIEWER);
  const set = (patch: Partial<ViewerSettings>, key?: string) => update((bk) => ({ ...bk, viewer: { ...ViewerSettings.parse(bk.viewer ?? DEFAULT_VIEWER), ...patch } }), key);
  return (
    <>
      <Section title="넘김 방식">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["flip", "책장 넘김", "종이책처럼"],
              ["slide", "슬라이드", "옆으로 밀기"],
              ["scroll", "세로 스크롤", "웹페이지처럼"],
            ] as const
          ).map(([m, l, h]) => (
            <button key={m} type="button" onClick={() => set({ mode: m })} className={`rounded-xl border p-2.5 text-left transition ${v.mode === m ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/15" : "border-black/10 hover:border-black/20"}`}>
              <span className="block text-[13px] font-semibold">{l}</span>
              <span className="block text-[11px] text-neutral-500">{h}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="배경·로고">
        <Row label="배경색">
          <span className="flex items-center gap-1.5">
            <input type="color" className="h-8 w-10 cursor-pointer rounded-lg border border-black/10 bg-white p-0.5" value={toHex6(v.background, "#1b1826")} onChange={(e) => set({ background: e.target.value }, "viewer:bg")} />
            {v.background && <button type="button" className="text-xs text-neutral-500 underline" onClick={() => set({ background: undefined })}>기본값</button>}
          </span>
        </Row>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={async () => { const u = await pickImageUrl(); if (u) set({ backgroundImage: u }); }}>{v.backgroundImage ? "배경 사진 바꾸기" : "배경 사진"}</button>
          {v.backgroundImage && <button type="button" className="btn-danger" onClick={() => set({ backgroundImage: undefined })}>빼기</button>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={async () => { const u = await pickImageUrl(); if (u) set({ logo: u }); }}>{v.logo ? "로고 바꾸기" : "로고 넣기"}</button>
          {v.logo && <button type="button" className="btn-danger" onClick={() => set({ logo: undefined })}>빼기</button>}
        </div>
        {v.logo && <input className={small} placeholder="로고를 누르면 갈 주소 (선택)" value={v.logoHref ?? ""} onChange={(e) => set({ logoHref: e.target.value.trim() || undefined }, "viewer:logoHref")} />}
      </Section>

      <Section title="소리">
        <Toggle label="책장 넘기는 소리" checked={v.flipSound} onChange={(x) => set({ flipSound: x })} />
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={async () => { const u = await pickAudioUrl(); if (u) set({ music: u }); }}>{v.music ? "배경 음악 바꾸기" : "배경 음악 넣기"}</button>
          {v.music && <button type="button" className="btn-danger" onClick={() => set({ music: undefined })}>빼기</button>}
        </div>
        {v.music && <audio src={v.music} controls className="w-full" />}
      </Section>

      <Section title="읽기">
        <Row label="자동 넘김 간격">
          <select className={`${small} w-28`} value={v.autoplaySeconds} onChange={(e) => set({ autoplaySeconds: Number(e.target.value) })}>
            <option value={0}>기본 (4초)</option>
            {[2, 3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n}초</option>)}
          </select>
        </Row>
        <Toggle label="쪽 번호 보이기" checked={v.showPageNumbers} onChange={(x) => set({ showPageNumbers: x })} />
        <Toggle label="PDF 저장·인쇄 허용" hint="공개 플립북에 다운로드 버튼이 생겨요" checked={v.allowDownload} onChange={(x) => set({ allowDownload: x })} />
      </Section>

      <TocEditor book={book} update={update} />

      <Section title="도구 막대 버튼">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {(Object.keys(BUTTON_LABEL) as (keyof ViewerSettings["buttons"])[]).map((k) => (
            <Toggle key={k} label={BUTTON_LABEL[k]} checked={v.buttons[k]} onChange={(x) => set({ buttons: { ...v.buttons, [k]: x } })} />
          ))}
        </div>
      </Section>
      <p className="text-xs text-neutral-400">바꾼 설정은 미리보기에 바로 보이고, 공개 플립북에는 다시 퍼블리시하면 반영돼요.</p>
    </>
  );
}

// ── 뷰어 목차 ─────────────────────────────────────────

function TocEditor({ book, update }: { book: Book; update: Update }) {
  const toc = book.toc;
  const setToc = (next: Book["toc"], key?: string) => update((bk) => ({ ...bk, toc: next && next.length ? next : undefined }), key);
  const edit = (i: number, patch: Partial<NonNullable<Book["toc"]>[number]>, key?: string) =>
    toc && setToc(toc.map((e, j) => (j === i ? { ...e, ...patch } : e)), key);
  return (
    <Section
      title="뷰어 목차"
      right={
        toc ? (
          <button type="button" className="text-xs text-neutral-500 underline" onClick={() => confirm("직접 만든 목차를 지우고 챕터 제목으로 자동 목차를 쓸까요?") && setToc(undefined)}>자동으로</button>
        ) : undefined
      }
    >
      {!toc ? (
        <>
          <p className="text-xs text-neutral-500">지금은 챕터 시작 페이지 제목으로 자동으로 만들어져요. 직접 정하려면 항목을 추가하세요.</p>
          <button type="button" className="btn" onClick={() => setToc([{ title: "처음", page: 1, level: 1 }])}>목차 직접 만들기</button>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {toc.map((e, i) => (
              <li key={i} className="flex items-center gap-1" style={{ paddingLeft: (e.level - 1) * 10 }}>
                <input className={`${small} !w-auto min-w-0 flex-1`} value={e.title} maxLength={300} onChange={(ev) => edit(i, { title: ev.target.value }, `toc:${i}:t`)} />
                <input
                  type="number"
                  className={`${small} !w-14 shrink-0 px-1.5`}
                  min={1}
                  max={book.pages.length}
                  value={e.page}
                  aria-label="쪽"
                  onChange={(ev) => edit(i, { page: Math.max(1, Math.min(book.pages.length, Math.round(Number(ev.target.value)) || 1)) }, `toc:${i}:p`)}
                />
                <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title="들여쓰기" onClick={() => edit(i, { level: e.level >= 3 ? 1 : e.level + 1 })}>⇥</button>
                <button type="button" className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label="삭제" onClick={() => setToc(toc.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" disabled={toc.length >= 500} onClick={() => setToc([...toc, { title: "새 항목", page: Math.min(book.pages.length, (toc.at(-1)?.page ?? 0) + 1), level: 1 }])}>항목 추가</button>
        </>
      )}
    </Section>
  );
}
