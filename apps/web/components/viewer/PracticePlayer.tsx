"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Repeat, RotateCcw } from "lucide-react";
import type { Block } from "@ebook/schema";

// 연습 플레이어 — 세광 음악 교과서의 악보 영상 플레이어를 옮겨 왔다.
//  · 트랙(노래·반주·원어·성부·악기…)을 바꿔도 지금 위치에서 이어 재생
//  · 절 → 구간 버튼으로 원하는 마디부터 재생
//  · 더한 것: 재생 속도, 지금 구간만 반복, 처음으로

type PlayerData = Extract<Block, { type: "player" }>["data"];
const SPEEDS = [0.5, 0.75, 1, 1.25] as const;
const isAudio = (src: string) => /\.(mp3|m4a|ogg|wav)(\?|#|$)/i.test(src);
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function PracticePlayer({ data }: { data: PlayerData }) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [track, setTrack] = useState(0);
  const [verse, setVerse] = useState(0);
  const [section, setSection] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const resume = useRef<{ t: number; play: boolean } | null>(null);

  const src = data.tracks[Math.min(track, data.tracks.length - 1)]?.src ?? "";
  const verses = data.verses.filter((v) => v.sections.length);
  const cur = verses[Math.min(verse, Math.max(0, verses.length - 1))];
  // 구간 끝 = 다음 구간 시작 (마지막이면 다음 절 첫 구간, 없으면 끝까지)
  const bounds = useMemo(() => {
    if (!cur || section === null) return null;
    const start = cur.sections[section].time;
    const next = cur.sections[section + 1]?.time ?? verses[verse + 1]?.sections[0]?.time ?? Infinity;
    return { start, end: next > start ? next : Infinity };
  }, [cur, section, verse, verses]);

  // 트랙을 바꾸면 같은 위치에서 이어서
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    const onMeta = () => {
      if (resume.current) {
        m.currentTime = resume.current.t;
        m.playbackRate = speed;
        if (resume.current.play) void m.play().catch(() => {});
        resume.current = null;
      }
    };
    m.addEventListener("loadedmetadata", onMeta);
    return () => m.removeEventListener("loadedmetadata", onMeta);
  }, [src, speed]);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [speed]);

  // 구간 반복
  const onTime = () => {
    const m = mediaRef.current;
    if (!m) return;
    setTime(m.currentTime);
    if (loop && bounds && Number.isFinite(bounds.end) && m.currentTime >= bounds.end - 0.05) m.currentTime = bounds.start;
  };

  const switchTrack = (i: number) => {
    const m = mediaRef.current;
    if (i === track) return;
    resume.current = m ? { t: m.currentTime, play: !m.paused } : null;
    setTrack(i);
  };
  const jump = (k: number) => {
    const m = mediaRef.current;
    if (!m || !cur) return;
    setSection(k);
    m.currentTime = cur.sections[k].time;
    void m.play().catch(() => {});
  };

  const Media = isAudio(src) ? "audio" : "video";
  const pill = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? "bg-brand-600 text-white shadow-sm" : "bg-white/10 text-white/80 hover:bg-white/20"}`;

  return (
    <div className="flex flex-col gap-4 bg-[#15131d] p-5 pt-6 text-white sm:p-6">
      {data.title && <h3 className="pr-10 text-lg font-bold">{data.title}</h3>}

      {data.tracks.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="트랙">
          {data.tracks.map((t, i) => (
            <button key={i} type="button" className={pill(track === i)} aria-pressed={track === i} onClick={() => switchTrack(i)}>{t.label}</button>
          ))}
        </div>
      )}

      <Media
        ref={mediaRef}
        key={Media}
        src={src}
        controls
        playsInline
        preload="auto"
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={Media === "video" ? "aspect-video w-full rounded-xl bg-black" : "w-full"}
      />

      {verses.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-white/[0.06] p-3.5">
          {verses.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-white/50">절</span>
              {verses.map((v, i) => (
                <button key={i} type="button" className={pill(verse === i)} onClick={() => { setVerse(i); setSection(null); }}>{v.label || `${i + 1}절`}</button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-white/50">구간</span>
            {cur?.sections.map((s, k) => (
              <button
                key={k}
                type="button"
                title={fmt(s.time)}
                className={`min-w-10 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums transition ${section === k ? "bg-white text-ink" : "bg-white/10 text-white/85 hover:bg-white/20"}`}
                onClick={() => jump(k)}
              >
                {s.label || k + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="grid size-10 place-items-center rounded-full bg-white text-ink hover:bg-white/90" aria-label={playing ? "멈춤" : "재생"} onClick={() => (mediaRef.current?.paused ? void mediaRef.current?.play() : mediaRef.current?.pause())}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <button type="button" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="처음으로" onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = bounds?.start ?? 0; }}>
          <RotateCcw className="size-4" />
        </button>
        <span className="w-12 text-white/60 tabular-nums">{fmt(time)}</span>
        <button
          type="button"
          disabled={section === null}
          aria-pressed={loop}
          title={section === null ? "구간을 먼저 고르세요" : "지금 구간만 반복"}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 transition disabled:opacity-35 ${loop ? "bg-brand-600 text-white" : "bg-white/10 hover:bg-white/20"}`}
          onClick={() => setLoop((l) => !l)}
        >
          <Repeat className="size-4" /> 구간 반복
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/10 p-1" role="group" aria-label="재생 속도">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${speed === s ? "bg-white text-ink" : "text-white/75 hover:text-white"}`}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
