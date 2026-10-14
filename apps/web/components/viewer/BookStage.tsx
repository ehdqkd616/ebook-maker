"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// 직접 만든 책장 넘김. 한 장(leaf)이 책등을 축으로 3D 회전하고, 회전 각도에 따라
//  · 앞면은 들릴수록 어두워지고 뒷면은 내려앉을수록 밝아지며 (빛),
//  · 아래 쪽에는 넘어가는 장의 그림자가 드리우고,
//  · 가운데 접힘 그림자와 남은 쪽수만큼의 책 두께가 보인다.
// 끌면 종이 가장자리가 손가락을 따라오고(각도 = acos(손가락 위치 / 쪽 너비)), 놓으면 가까운 쪽으로 마저 넘어간다.
// 표지·뒤표지만 보일 때는 책을 가운데로 옮긴다.
//
// 넘김 모델: 앞 펼침 L과 뒤 펼침 U 사이를 넘길 때
//   왼쪽 고정 = L의 왼쪽, 오른쪽 아래 = U의 오른쪽, 넘어가는 장 앞면 = L의 오른쪽, 뒷면 = U의 왼쪽.
//   각도 0이면 L을, -180이면 U를 보는 것과 같다. 앞으로 넘기면 0 → -180, 뒤로 넘기면 -180 → 0.

// 원근 거리 = 쪽 너비 × 이 값. 넘기는 동안 책이 부푸는 정도(최대 약 1/(값-1))를 정한다.
export const PERSPECTIVE_RATIO = 8;

export type StageHandle = { go: (i: number) => void; next: () => void; prev: () => void; pageElements: () => HTMLElement[] };

type Spread = { left: number | null; right: number | null };
type Turn = { lo: number; hi: number; from: number; to: number; target: number; peek?: boolean }; // lo/hi: 펼침 번호, from/to: 각도

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function BookStage({
  book,
  scale,
  spread: twoUp,
  startPage,
  showPageNumbers,
  onFlip,
  handleRef,
}: {
  book: Book;
  scale: number;
  spread: boolean;
  startPage: number;
  showPageNumbers: boolean;
  onFlip: (i: number) => void;
  handleRef: React.Ref<StageHandle>;
}) {
  const total = book.pages.length;
  const pw = Math.round(book.size.width * scale);
  const ph = Math.round(book.size.height * scale);

  // 펼침 목록 — 두 쪽 보기: [표지] [1,2] [3,4] … / 한 쪽 보기: 쪽마다
  const spreads: Spread[] = twoUp
    ? [{ left: null, right: 0 }, ...Array.from({ length: Math.ceil((total - 1) / 2) }, (_, k) => ({ left: 2 * k + 1, right: 2 * k + 2 < total ? 2 * k + 2 : null }))]
    : Array.from({ length: total }, (_, i) => ({ left: null, right: i }));
  const spreadOf = useCallback((i: number) => (twoUp ? (i <= 0 ? 0 : Math.ceil(i / 2)) : i), [twoUp]);
  const firstOf = (s: Spread) => (s.left ?? s.right ?? 0);

  const [view, setView] = useState(() => spreadOf(Math.max(0, Math.min(total - 1, startPage))));
  const [turn, setTurn] = useState<Turn | null>(null);
  const pageRef = useRef(firstOf(spreads[view] ?? spreads[0]));
  // 두 쪽/한 쪽 보기가 바뀌면 지금 보던 쪽이 있는 펼침으로
  useEffect(() => {
    setView(spreadOf(pageRef.current));
    setTurn(null);
  }, [twoUp, spreadOf]);

  const rootRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const shadeFrontRef = useRef<HTMLDivElement>(null);
  const shadeBackRef = useRef<HTMLDivElement>(null);
  const castRightRef = useRef<HTMLDivElement>(null);
  const castLeftRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const turnRef = useRef<Turn | null>(null);
  turnRef.current = turn;
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const offsetOf = useCallback(
    (s: Spread) => (!twoUp ? 0 : s.left === null ? -pw / 2 : s.right === null ? pw / 2 : 0),
    [twoUp, pw],
  );

  /** 각도(0 ~ -180)에 맞춰 장·빛·그림자를 그린다 — 매 프레임 DOM을 직접 고친다 */
  const paint = useCallback(
    (angle: number) => {
      angleRef.current = angle;
      const t = turnRef.current;
      const p = Math.min(1, Math.max(0, -angle / 180)); // 0: 앞 펼침, 1: 뒤 펼침
      const rad = (-angle * Math.PI) / 180;
      const lift = Math.sin(rad); // 세워진 정도
      if (leafRef.current) {
        leafRef.current.style.transform = `rotateY(${angle}deg)`;
        // 한 쪽 보기에서는 넘어간 장이 책 밖(왼쪽)으로 나가므로 뒤로 갈수록 흐려지게
        if (!twoUp) leafRef.current.style.opacity = String(p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.45) : 1);
      }
      if (shadeFrontRef.current) shadeFrontRef.current.style.opacity = String(Math.min(1, p * 2.2) * 0.85);
      if (shadeBackRef.current) shadeBackRef.current.style.opacity = String(Math.min(1, (1 - p) * 2.2) * 0.85);
      // 아래 쪽 그림자: 장 가장자리가 화면에 비친 자리 바로 옆
      const edge = pw * Math.cos(rad); // 책등 기준, 앞쪽(+)/뒤쪽(-)
      if (castRightRef.current) {
        const on = p < 0.5;
        castRightRef.current.style.opacity = on ? String((1 - p * 2) * 0.9 + 0.1) : "0";
        castRightRef.current.style.transform = `translateX(${Math.max(0, edge)}px)`;
        castRightRef.current.style.width = `${Math.max(12, 90 * lift)}px`;
      }
      if (castLeftRef.current) {
        const on = p > 0.5;
        castLeftRef.current.style.opacity = on ? String(((p - 0.5) * 2) * 0.9 + 0.1) : "0";
        castLeftRef.current.style.transform = `translateX(${Math.min(0, edge)}px)`;
        castLeftRef.current.style.width = `${Math.max(12, 90 * lift)}px`;
      }
      // 표지 ↔ 첫 펼침처럼 한쪽이 비는 펼침 사이에서는 책을 조금씩 가운데로 옮긴다
      if (bookRef.current && t) {
        const a = offsetOf(spreads[t.lo]);
        const b = offsetOf(spreads[t.hi]);
        bookRef.current.style.transform = `translateX(${a + (b - a) * ease(p)}px)`;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pw, offsetOf, twoUp, total],
  );

  /** 지금 각도에서 to까지 움직이고, 끝나면 펼침을 확정한다 */
  const animate = useCallback(
    (to: number, done: () => void, curve = ease) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const from = angleRef.current;
      const dur = reduced ? 0 : Math.max(220, (Math.abs(to - from) / 180) * 820);
      const start = performance.now();
      const step = (now: number) => {
        const k = dur ? Math.min(1, (now - start) / dur) : 1;
        paint(from + (to - from) * curve(k));
        if (k < 1) animRef.current = requestAnimationFrame(step);
        else {
          animRef.current = null;
          done();
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [paint, reduced],
  );

  // 넘김이 막 시작되면(새 장이 그려진 뒤) 시작 각도를 칠하고 움직인다
  const pendingRef = useRef<{ to: number; curve?: (t: number) => number } | null>(null);
  useLayoutEffect(() => {
    if (!turn) return;
    paint(angleRef.current);
    const pend = pendingRef.current;
    if (pend) {
      pendingRef.current = null;
      animate(pend.to, () => finish(), pend.curve);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  const finish = useCallback(() => {
    const t = turnRef.current;
    if (!t) return;
    const landed = angleRef.current <= -90 ? t.hi : t.lo;
    setView(landed);
    setTurn(null);
    angleRef.current = 0;
    if (bookRef.current) bookRef.current.style.transform = `translateX(${offsetOf(spreads[landed])}px)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetOf, twoUp, total]);

  /** 펼침 target으로 넘긴다 (멀리 건너뛰어도 한 장 넘김으로 보여 준다) */
  const turnTo = useCallback(
    (target: number) => {
      target = Math.max(0, Math.min(spreads.length - 1, target));
      const cur = turnRef.current && !turnRef.current.peek ? (angleRef.current <= -90 ? turnRef.current.hi : turnRef.current.lo) : view;
      if (turnRef.current?.peek) angleRef.current = 0;
      if (turnRef.current) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        animRef.current = null;
        setView(cur);
        setTurn(null);
      }
      if (target === cur) return;
      const forward = target > cur;
      const lo = forward ? cur : target;
      const hi = forward ? target : cur;
      angleRef.current = forward ? 0 : -180;
      pendingRef.current = { to: forward ? -180 : 0 };
      setTurn({ lo, hi, from: angleRef.current, to: forward ? -180 : 0, target });
      const page = firstOf(spreads[target]);
      pageRef.current = page;
      onFlipRef.current(page);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, twoUp, total],
  );

  useImperativeHandle(handleRef, () => ({
    go: (i) => turnTo(spreadOf(Math.max(0, Math.min(total - 1, i)))),
    next: () => turnTo((turnRef.current?.target ?? view) + 1),
    prev: () => turnTo((turnRef.current?.target ?? view) - 1),
    pageElements: () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-page-index]") ?? []),
  }));

  // ── 끌어서 넘기기 ──
  const drag = useRef<{ id: number; x0: number; y0: number; forward: boolean; started: boolean; spine: number; lastX: number; lastT: number; vx: number } | null>(null);
  const isInteractive = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest("a, button, input, textarea, select, iframe, video, audio, [data-eb-block], [data-eb-goto], [data-eb-slide]");

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    // 모서리 들림 힌트 중이면 멈추고 바로 끌기를 시작한다
    if (turnRef.current?.peek) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      angleRef.current = 0;
      turnRef.current = null;
      setTurn(null);
    }
    if (turnRef.current) return;
    const rect = bookRef.current!.getBoundingClientRect();
    const spine = twoUp ? rect.left + rect.width / 2 : rect.left;
    const s = spreads[view];
    const onRight = twoUp ? e.clientX >= spine : e.clientX - rect.left > rect.width * 0.4;
    const forward = onRight ? !!(view < spreads.length - 1 && s) : false;
    if (onRight ? view >= spreads.length - 1 : view <= 0) {
      drag.current = null;
      return;
    }
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, forward, started: false, spine, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      hover(e);
      return;
    }
    const dx = e.clientX - d.x0;
    if (!d.started) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - d.y0)) return;
      d.started = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const lo = d.forward ? view : view - 1;
      angleRef.current = d.forward ? 0 : -180;
      setTurn({ lo, hi: lo + 1, from: angleRef.current, to: angleRef.current, target: d.forward ? view + 1 : view - 1 });
    }
    d.vx = (e.clientX - d.lastX) / Math.max(1, e.timeStamp - d.lastT);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    // 장 가장자리가 손가락 아래 오도록: cos(각도) = (손가락 - 책등) / 쪽 너비
    const zoomed = bookRef.current!.getBoundingClientRect().height / ph || 1;
    const rel = (e.clientX - d.spine) / (pw * zoomed);
    const angle = (-Math.acos(Math.max(-1, Math.min(1, rel))) * 180) / Math.PI;
    paint(angle);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.started) {
      // 눌렀다 뗐으면: 오른쪽은 다음, 왼쪽은 이전
      if (Math.abs(e.clientX - d.x0) < 8) d.forward ? turnTo(view + 1) : turnTo(view - 1);
      return;
    }
    const t = turnRef.current;
    if (!t) return;
    // 반 넘게 넘겼거나 빠르게 튕기면 마저 넘긴다
    const toHi = d.vx < -0.4 ? true : d.vx > 0.4 ? false : angleRef.current <= -90;
    const landed = toHi ? t.hi : t.lo;
    if (landed !== view) {
      pageRef.current = firstOf(spreads[landed]);
      onFlipRef.current(pageRef.current);
    }
    setTurn({ ...t, target: landed });
    animate(toHi ? -180 : 0, () => finish(), easeOut);
  };

  // 오른쪽 모서리에 마우스를 올리면 살짝 들린다
  const hoverLift = useRef(false);
  const hover = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || turnRef.current || !bookRef.current || reduced) return;
    const rect = bookRef.current.getBoundingClientRect();
    const near = view < spreads.length - 1 && e.clientX > rect.right - rect.width * 0.08 && e.clientX <= rect.right && e.clientY > rect.top && e.clientY < rect.bottom;
    if (near === hoverLift.current) return;
    hoverLift.current = near;
    if (near) peek();
  };

  /** 다음 장 모서리를 살짝 들었다 내린다 (처음 펼쳤을 때 넘길 수 있다는 힌트) */
  const peek = useCallback(() => {
    if (turnRef.current || view >= spreads.length - 1 || reduced) return;
    angleRef.current = 0;
    setTurn({ lo: view, hi: view + 1, from: 0, to: 0, target: view, peek: true });
    const done = () => {
      if (!turnRef.current?.peek) return; // 그사이 사용자가 넘기기 시작했다
      setTurn(null);
      angleRef.current = 0;
    };
    requestAnimationFrame(() => turnRef.current?.peek && animate(-16, () => turnRef.current?.peek && animate(0, done, easeOut), easeOut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, spreads.length, animate, reduced]);

  useEffect(() => {
    const id = setTimeout(peek, 1400);
    return () => clearTimeout(id);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  // ── 무엇을 그릴지 ──
  const cur = spreads[Math.min(view, spreads.length - 1)] ?? { left: null, right: null };
  const lo = turn ? spreads[turn.lo] : null;
  const hi = turn ? spreads[turn.hi] : null;
  const staticLeft = turn ? (twoUp ? lo!.left : null) : cur.left;
  const staticRight = turn ? hi!.right : cur.right;
  const leafFront = turn ? lo!.right : null;
  const leafBack = turn && twoUp ? hi!.left : null;
  const shown = turn ? spreads[turn.target] : cur;
  const active = new Set([shown?.left, shown?.right].filter((x): x is number => x !== null && x !== undefined));

  // 책 두께: 왼쪽은 읽은 쪽, 오른쪽은 남은 쪽만큼 (최대 10px)
  const maxT = Math.min(10, Math.max(2, total / 6));
  const readFrac = total > 1 ? firstOf(shown ?? cur) / (total - 1) : 0;
  const leftT = twoUp && (shown?.left ?? null) !== null ? Math.max(1, Math.round(maxT * readFrac)) : 0;
  const rightT = (shown?.right ?? null) !== null ? Math.max(1, Math.round(maxT * (1 - readFrac))) : 0;

  const bookW = twoUp ? pw * 2 : pw;
  // 보이는 쪽에 eb-page-active를 붙여 등장 애니메이션을 재생한다 (넘기는 중이면 넘어갈 펼침 기준)
  const page = (i: number | null) =>
    i === null ? null : (
      <div data-page-index={i} className={active.has(i) ? "eb-page-active" : undefined}>
        <PageRenderer
          page={book.pages[i]}
          theme={book.theme}
          size={book.size}
          scale={scale}
          pageNumber={showPageNumbers && showsPageNumber(book.pages[i].layoutId) ? i + 1 : undefined}
        />
      </div>
    );

  // 쪽 안쪽(책등 쪽)의 접힘 그림자
  const gutter = (side: "left" | "right", lone = false) => (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 z-[1]"
      style={{
        [side === "left" ? "right" : "left"]: 0,
        width: Math.max(18, pw * (lone ? 0.04 : 0.09)),
        // 반대쪽이 비어 있으면(표지·뒤표지) 접힘이 아니라 경첩이므로 옅게
        background: `linear-gradient(to ${side === "left" ? "left" : "right"}, rgba(0,0,0,${lone ? 0.12 : 0.22}), rgba(0,0,0,${lone ? 0.03 : 0.07}) 35%, rgba(0,0,0,0))`,
      }}
    />
  );

  return (
    <div
      ref={rootRef}
      className="eb-book-stage relative flex h-full w-full touch-pan-y items-center justify-center select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => (hoverLift.current = false)}
    >
      <div
        ref={bookRef}
        className="relative"
        style={{
          width: bookW,
          height: ph,
          perspective: pw * PERSPECTIVE_RATIO,
          transform: `translateX(${turn ? offsetOf(spreads[turn.lo]) : offsetOf(cur)}px)`,
          transition: turn ? undefined : "transform .45s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* 바닥 그림자 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 -bottom-3 top-3 rounded-[4px]"
          style={{
            left: twoUp && staticLeft === null && !turn ? pw : -8,
            right: twoUp && staticRight === null && !turn ? pw : -8,
            boxShadow: "0 30px 60px -18px rgba(0,0,0,.65), 0 12px 24px -12px rgba(0,0,0,.5)",
          }}
        />

        {/* 책 두께 (쪽 단면) */}
        {leftT > 0 && (
          <div aria-hidden className="eb-page-edge absolute top-[2px] bottom-[2px]" style={{ left: -leftT, width: leftT, borderRadius: "3px 0 0 3px" }} />
        )}
        {rightT > 0 && (
          <div aria-hidden className="eb-page-edge absolute top-[2px] bottom-[2px]" style={{ left: (twoUp ? pw * 2 : pw), width: rightT, borderRadius: "0 3px 3px 0" }} />
        )}

        {/* 왼쪽 고정 쪽 */}
        {twoUp && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: pw, height: ph }}>
            {page(staticLeft)}
            {staticLeft !== null && gutter("left", !turn && staticRight === null)}
            <div ref={castLeftRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-[2] origin-right opacity-0" style={{ width: 40, background: "linear-gradient(to left, rgba(0,0,0,.38), rgba(0,0,0,0))", marginRight: 0, transformOrigin: "right" }} />
          </div>
        )}

        {/* 오른쪽 고정 쪽 (넘기는 동안에는 다음 펼침의 오른쪽) */}
        <div className="absolute top-0 overflow-hidden" style={{ left: twoUp ? pw : 0, width: pw, height: ph }}>
          {page(staticRight)}
          {staticRight !== null && twoUp && gutter("right", !turn && staticLeft === null)}
          <div ref={castRightRef} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-[2] opacity-0" style={{ width: 40, background: "linear-gradient(to right, rgba(0,0,0,.38), rgba(0,0,0,0))" }} />
        </div>

        {/* 넘어가는 장 */}
        {turn && (
          <div
            ref={leafRef}
            className="absolute top-0 z-[3]"
            style={{
              left: twoUp ? pw : 0,
              width: pw,
              height: ph,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              transform: `rotateY(${angleRef.current}deg)`,
              willChange: "transform",
            }}
          >
            {/* 앞면 */}
            <div className="absolute inset-0 overflow-hidden" style={{ backfaceVisibility: "hidden", boxShadow: "0 0 18px rgba(0,0,0,.18)" }}>
              {page(leafFront)}
              {twoUp && gutter("right")}
              <div
                ref={shadeFrontRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[2] opacity-0"
                style={{ background: "linear-gradient(to right, rgba(0,0,0,.28) 0%, rgba(0,0,0,.06) 35%, rgba(255,255,255,.10) 70%, rgba(0,0,0,.30) 100%)" }}
              />
            </div>
            {/* 뒷면 (거울처럼 뒤집어 붙인다) */}
            <div className="absolute inset-0 overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: book.theme.background, boxShadow: "0 0 18px rgba(0,0,0,.18)" }}>
              {page(leafBack)}
              {twoUp && gutter("left")}
              <div
                ref={shadeBackRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[2] opacity-0"
                style={{ background: "linear-gradient(to left, rgba(0,0,0,.28) 0%, rgba(0,0,0,.06) 35%, rgba(255,255,255,.10) 70%, rgba(0,0,0,.30) 100%)" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
