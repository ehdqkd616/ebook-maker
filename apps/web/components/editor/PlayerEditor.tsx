"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Icon, ICON_LABEL } from "@ebook/renderer";
import { ICONS, type Block, type IconName } from "@ebook/schema";

// 연습 플레이어·활동 아이콘 편집

type Set = (fn: (b: Block) => Block, key?: string) => void;
const small = "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function IconPicker({ value, onChange }: { value: IconName; onChange: (v: IconName) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {ICONS.map((n) => (
        <button
          key={n}
          type="button"
          title={ICON_LABEL[n]}
          aria-label={ICON_LABEL[n]}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`grid aspect-square place-items-center rounded-lg transition ${value === n ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
        >
          <Icon name={n} className="size-4" />
        </button>
      ))}
    </div>
  );
}

export function IconSection({ block, set }: { block: Extract<Block, { type: "icon" }>; set: Set }) {
  const patch = (p: Partial<typeof block.data>, key?: string) => set((b) => (b.type === "icon" ? { ...b, data: { ...b.data, ...p } } : b), key);
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[11px] font-bold tracking-[0.06em] text-neutral-400 uppercase">활동 아이콘</h3>
      <IconPicker value={block.data.icon} onChange={(icon) => patch({ icon })} />
      <label className="flex items-center justify-between gap-3">
        <span className="text-neutral-600">색</span>
        <span className="flex items-center gap-1.5">
          <input type="color" className="h-8 w-10 cursor-pointer rounded-lg border border-black/10 bg-white p-0.5" value={/^#[0-9a-f]{6}$/i.test(block.data.color ?? "") ? block.data.color : "#6339e6"} onChange={(e) => patch({ color: e.target.value }, `ic:${block.id}`)} />
          {block.data.color && <button type="button" className="text-xs text-neutral-500 underline" onClick={() => patch({ color: undefined })}>테마 색</button>}
        </span>
      </label>
      <input className={small} placeholder="옆에 붙일 글자 (선택, 예: 활동 1)" maxLength={40} value={block.data.label ?? ""} onChange={(e) => patch({ label: e.target.value || undefined }, `il:${block.id}`)} />
      <p className="text-xs text-neutral-400">아래 &quot;눌렀을 때&quot;에서 팝업(활동지·사진·동영상)이나 쪽 이동을 정하세요.</p>
    </section>
  );
}

export function PlayerSection({ block, set, pickMediaUrl }: { block: Extract<Block, { type: "player" }>; set: Set; pickMediaUrl: () => Promise<string | null> }) {
  const d = block.data;
  const patch = (p: Partial<typeof d>, key?: string) => set((b) => (b.type === "player" ? { ...b, data: { ...b.data, ...p } } : b), key);
  const preview = useRef<HTMLVideoElement>(null);
  const [pv, setPv] = useState(0); // 미리보기 트랙
  const [verse, setVerse] = useState(0);
  const verses = d.verses.length ? d.verses : [];
  const v = verses[Math.min(verse, verses.length - 1)];
  const setVerses = (list: typeof d.verses) => patch({ verses: list });

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-bold tracking-[0.06em] text-neutral-400 uppercase">연습 플레이어</h3>
      <input className={small} placeholder="제목 (예: 즐거운 봄)" maxLength={120} value={d.title ?? ""} onChange={(e) => patch({ title: e.target.value || undefined }, `pt:${block.id}`)} />
      <IconPicker value={d.icon} onChange={(icon) => patch({ icon })} />

      <div className="flex flex-col gap-1.5">
        <span className="text-neutral-600">트랙 <span className="text-xs text-neutral-400">노래·반주·성부·악기 등 — 영상이나 소리 파일</span></span>
        {d.tracks.map((t, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-2 ring-1 ring-black/5">
            <div className="flex gap-1">
              <input className={`${small} !w-28 shrink-0`} value={t.label} maxLength={30} placeholder="이름" onChange={(e) => patch({ tracks: d.tracks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, `tl:${block.id}:${i}`)} />
              <button type="button" className="btn shrink-0 px-2" title="파일 올리기" onClick={async () => { const u = await pickMediaUrl(); if (u) patch({ tracks: d.tracks.map((x, j) => (j === i ? { ...x, src: u } : x)) }); }}><Upload className="size-3.5" /></button>
              <button type="button" className="btn shrink-0 px-2" title="미리 듣기" onClick={() => setPv(i)} aria-pressed={pv === i}>▶</button>
              <button type="button" className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={d.tracks.length <= 1} aria-label="트랙 빼기" onClick={() => patch({ tracks: d.tracks.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></button>
            </div>
            <input className={`${small} text-xs`} value={t.src} placeholder="https://… 또는 올리기" onChange={(e) => patch({ tracks: d.tracks.map((x, j) => (j === i ? { ...x, src: e.target.value.trim() } : x)) }, `ts:${block.id}:${i}`)} />
          </div>
        ))}
        <button type="button" className="btn" disabled={d.tracks.length >= 20} onClick={() => patch({ tracks: [...d.tracks, { label: `트랙 ${d.tracks.length + 1}`, src: "" }] })}><Plus className="size-4" /> 트랙 추가</button>
      </div>

      {d.tracks[pv]?.src && (
        <video ref={preview} key={d.tracks[pv].src} src={d.tracks[pv].src} controls playsInline className="w-full rounded-lg bg-black" style={{ maxHeight: 160 }} />
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-neutral-600">절·구간 <span className="text-xs text-neutral-400">구간 버튼을 누르면 그 시각부터 재생</span></span>
        <div className="flex flex-wrap items-center gap-1">
          {verses.map((x, i) => (
            <button key={i} type="button" onClick={() => setVerse(i)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${i === verse ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>{x.label || `${i + 1}절`}</button>
          ))}
          <button type="button" className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200" disabled={verses.length >= 20} onClick={() => { setVerses([...verses, { sections: [] }]); setVerse(verses.length); }}>+ 절</button>
          {v && <button type="button" className="ml-auto text-xs text-red-500 underline" onClick={() => { setVerses(verses.filter((_, i) => i !== verse)); setVerse(Math.max(0, verse - 1)); }}>이 절 빼기</button>}
        </div>
        {v && (
          <>
            <ul className="flex flex-col gap-1">
              {v.sections.map((sec, k) => (
                <li key={k} className="flex items-center gap-1">
                  <span className="w-6 text-center text-xs font-semibold text-neutral-400">{k + 1}</span>
                  <input className={`${small} !w-24`} placeholder="이름 (선택)" maxLength={40} value={sec.label ?? ""} onChange={(e) => setVerses(verses.map((x, i) => (i === verse ? { ...x, sections: x.sections.map((y, j) => (j === k ? { ...y, label: e.target.value || undefined } : y)) } : x)))} />
                  <input type="number" step={0.1} min={0} className={`${small} !w-20`} value={sec.time} aria-label="시작(초)" onChange={(e) => setVerses(verses.map((x, i) => (i === verse ? { ...x, sections: x.sections.map((y, j) => (j === k ? { ...y, time: Math.max(0, Number(e.target.value) || 0) } : y)) } : x)))} />
                  <span className="w-10 text-[11px] text-neutral-400 tabular-nums">{fmt(sec.time)}</span>
                  <button type="button" className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label="구간 빼기" onClick={() => setVerses(verses.map((x, i) => (i === verse ? { ...x, sections: x.sections.filter((_, j) => j !== k) } : x)))}><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const t = Math.round((preview.current?.currentTime ?? 0) * 10) / 10;
                const sections = [...v.sections, { time: t }].sort((a, b) => a.time - b.time);
                setVerses(verses.map((x, i) => (i === verse ? { ...x, sections } : x)));
              }}
            >
              <Plus className="size-4" /> 미리 듣기 위치({fmt(preview.current?.currentTime ?? 0)})로 구간 추가
            </button>
          </>
        )}
      </div>
    </section>
  );
}
