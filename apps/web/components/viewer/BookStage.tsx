"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { showsPageNumber } from "@ebook/layouts";
import { PageRenderer } from "@ebook/renderer";
import type { Book } from "@ebook/schema";

// 직접 만든 책장 넘김 — 종이 모서리를 잡아 말아 넘기는 방식 (2D 접기).
// 넘어가는 장은 비틀거나 기울이지 않는다. 모서리 C가 점 P로 끌려오면 접힌 선은 C·P의 수직이등분선이고,
//  · 접힌 선 안쪽(책등 쪽)은 앞면 그대로,
//  · 바깥쪽은 접힌 선을 기준으로 뒤집혀(반사) 뒷면이 보이고,
//  · 그 아래로 다음 쪽이 드러나며 접힌 선을 따라 그림자·빛이 진다.
// 끌면 모서리가 손가락을 따라오고, 놓으면 가까운 쪽으로/빠르게 튕기면 넘어간다.
// 표지·뒤표지만 보일 때는 책을 가운데로 옮긴다.
//
// 좌표: 오른쪽 쪽의 왼쪽 위(책등 위)가 원점, 너비 W·높이 H. 앞으로 넘기면 P가 (W, cy) → (-W, cy),
// 뒤로 넘기면 반대. P.x로 진행 정도(0: 앞 펼침, 1: 뒤 펼침)를 구한다.
//   왼쪽 고정 = L의 왼쪽, 오른쪽 아래 = U의 오른쪽, 넘어가는 장 앞면 = L의 오른쪽, 뒷면 = U의 왼쪽.

export type StageHandle = { go: (i: number) => void; next: () => void; prev: () => void; pageElements: () => HTMLElement[] };

type Spread = { left: number | null; right: number | null };
type Turn = { lo: number; hi: number; target: number; peek?: boolean }; // lo/hi: 펼침 번호
type Pt = { x: number; y: number };

/** 볼록 다각형을 반평면 ((p - q)·n) * keep >= 0 으로 자른다 */
function clipHalf(poly: Pt[], q: Pt, n: Pt, keep: 1 | -1): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt) => ((p.x - q.x) * n.x + (p.y - q.y) * n.y) * keep;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}
const toClip = (pts: Pt[]) => (pts.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${pts.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(",")})`);

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
  renderOverlay,
}: {
  book: Book;
  scale: number;
  spread: boolean;
  startPage: number;
  showPageNumbers: boolean;
  onFlip: (i: number) => void;
  handleRef: React.Ref<StageHandle>;
  /** 쪽 위에 겹쳐 그릴 것(판서 등) — 쪽과 함께 넘어간다. 좌표는 책 크기(px) 기준 */
  renderOverlay?: (pageIndex: number) => React.ReactNode;
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
  const frontRef = useRef<HTMLDivElement>(null); // 앞면 (접힌 선 안쪽만)
  const underRef = useRef<HTMLDivElement>(null); // 드러난 다음 쪽 위의 그림자
  const underShadeRef = useRef<HTMLDivElement>(null);
  const backWrapRef = useRef<HTMLDivElement>(null); // 말린 뒷면 (그림자 필터)
  const backClipRef = useRef<HTMLDivElement>(null);
  const backPageRef = useRef<HTMLDivElement>(null);
  const backShadeRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Pt>({ x: 0, y: 0 }); // 끌려온 모서리 P
  const cornerYRef = useRef(0); // 잡은 모서리: 0(위) 또는 H(아래)
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

  const progressOf = (x: number) => Math.min(1, Math.max(0, (pw - x) / (2 * pw)));

  /** 모서리 위치 P에 맞춰 앞면·뒷면·그림자를 그린다 — 매 프레임 DOM을 직접 고친다 */
  const paint = useCallback(
    (raw: Pt) => {
      const W = pw;
      const H = ph;
      const cy = cornerYRef.current;
      // 종이는 늘어나지 않는다: 책등의 같은 높이 점에서 W, 반대 높이 점에서 대각선 길이 안쪽으로
      let P = { ...raw };
      const fit = (ax: number, ay: number, r: number) => {
        const dx = P.x - ax;
        const dy = P.y - ay;
        const d = Math.hypot(dx, dy);
        if (d > r) P = { x: ax + (dx / d) * r, y: ay + (dy / d) * r };
      };
      fit(0, cy, W);
      fit(0, H - cy, Math.hypot(W, H));
      posRef.current = P;
      const t = turnRef.current;
      const p = progressOf(P.x);

      const C = { x: W, y: cy };
      const dx = C.x - P.x;
      const dy = C.y - P.y;
      const dist = Math.hypot(dx, dy);
      const front = frontRef.current;
      const under = underRef.current;
      const backWrap = backWrapRef.current;
      const backClip = backClipRef.current;
      const backPage = backPageRef.current;
      if (front && under && backWrap && backClip && backPage) {
        if (dist < 0.5) {
          front.style.clipPath = "none";
          under.style.clipPath = toClip([]);
          backClip.style.clipPath = toClip([]);
        } else {
          const n = { x: dx / dist, y: dy / dist }; // 접힌 선의 법선 (모서리 쪽)
          const Q = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 }; // 접힌 선 위의 점
          const rect = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
          const stay = clipHalf(rect, Q, n, -1);
          const lifted = clipHalf(rect, Q, n, 1);
          const qn = Q.x * n.x + Q.y * n.y;
          const reflect = (s: Pt) => {
            const d = s.x * n.x + s.y * n.y - qn;
            return { x: s.x - 2 * d * n.x, y: s.y - 2 * d * n.y };
          };
          front.style.clipPath = toClip(stay);
          under.style.clipPath = toClip(lifted);
          backClip.style.clipPath = toClip(lifted.map(reflect));
          // 뒷면 쪽(u) → 화면: 좌우를 뒤집어(u.x → W - u.x) 접힌 선에 반사. 반사 두 번이라 글은 거울상이 아니다
          const a11 = 1 - 2 * n.x * n.x;
          const a12 = -2 * n.x * n.y;
          const a22 = 1 - 2 * n.y * n.y;
          backPage.style.transform = `matrix(${-a11}, ${-a12}, ${a12}, ${a22}, ${a11 * W + 2 * qn * n.x}, ${a12 * W + 2 * qn * n.y})`;

          // 접힌 선을 따라가는 띠 모양 그림자·빛
          const phi = Math.atan2(n.y, n.x);
          const L = Math.hypot(W, H) * 2;
          const lift = Math.min(1, dist / (W * 0.25)); // 막 들기 시작할 땐 옅게
          const under0 = underShadeRef.current;
          if (under0) {
            const w = Math.min(W * 0.4, 10 + dist * 0.22);
            under0.style.width = `${w}px`;
            under0.style.height = `${L * 2}px`;
            under0.style.transform = `translate(${Q.x}px, ${Q.y}px) rotate(${phi}rad) translate(0px, ${-L}px)`;
            under0.style.opacity = String(lift * (1 - p * 0.5));
          }
          const back0 = backShadeRef.current;
          if (back0) {
            const w = Math.max(24, dist / 2);
            back0.style.width = `${w}px`;
            back0.style.height = `${L * 2}px`;
            back0.style.transform = `translate(${Q.x}px, ${Q.y}px) rotate(${phi}rad) translate(${-w}px, ${-L}px)`;
            back0.style.opacity = String(0.35 + 0.65 * lift * (1 - p * 0.7));
          }
        }
        // 한 쪽 보기에서는 넘어간 장이 책 밖(왼쪽)으로 나가므로 뒤로 갈수록 흐려지게
        if (!twoUp) backWrap.style.opacity = String(p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.45) : 1);
      }
      // 표지 ↔ 첫 펼침처럼 한쪽이 비는 펼침 사이에서는 책을 조금씩 가운데로 옮긴다
      if (bookRef.current && t) {
        const a = offsetOf(spreads[t.lo]);
        const b = offsetOf(spreads[t.hi]);
        bookRef.current.style.transform = `translateX(${a + (b - a) * ease(p)}px)`;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pw, ph, offsetOf, twoUp, total],
  );

  /** 지금 위치에서 to까지 모서리를 옮기고(넘어가는 동안 살짝 들어 올린다), 끝나면 펼침을 확정한다 */
  const animate = useCallback(
    (to: Pt, done: () => void, curve = ease) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const from = { ...posRef.current };
      const span = Math.abs(to.x - from.x) / (2 * pw);
      const dur = reduced ? 0 : Math.max(220, span * 900);
      const arc = ph * 0.025 * span * (cornerYRef.current === 0 ? 1 : -1);
      const start = performance.now();
      const step = (now: number) => {
        const k = dur ? Math.min(1, (now - start) / dur) : 1;
        const e = curve(k);
        paint({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + arc * Math.sin(Math.PI * e) });
        if (k < 1) animRef.current = requestAnimationFrame(step);
        else {
          animRef.current = null;
          done();
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [paint, reduced, pw, ph],
  );

  // 넘김이 막 시작되면(새 장이 그려진 뒤) 시작 각도를 칠하고 움직인다
  const pendingRef = useRef<{ to: Pt; curve?: (t: number) => number } | null>(null);
  useLayoutEffect(() => {
    if (!turn) return;
    paint(posRef.current);
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
    const landed = progressOf(posRef.current.x) >= 0.5 ? t.hi : t.lo;
    setView(landed);
    setTurn(null);
    if (bookRef.current) bookRef.current.style.transform = `translateX(${offsetOf(spreads[landed])}px)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetOf, twoUp, total]);

  /** 펼침 target으로 넘긴다 (멀리 건너뛰어도 한 장 넘김으로 보여 준다) */
  const turnTo = useCallback(
    (target: number) => {
      target = Math.max(0, Math.min(spreads.length - 1, target));
      const cur = turnRef.current && !turnRef.current.peek ? (progressOf(posRef.current.x) >= 0.5 ? turnRef.current.hi : turnRef.current.lo) : view;
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
      cornerYRef.current = ph;
      posRef.current = { x: forward ? pw : -pw, y: ph };
      pendingRef.current = { to: { x: forward ? -pw : pw, y: ph } };
      setTurn({ lo, hi, target });
      const page = firstOf(spreads[target]);
      pageRef.current = page;
      onFlipRef.current(page);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, twoUp, total, pw, ph],
  );

  useImperativeHandle(handleRef, () => ({
    go: (i) => turnTo(spreadOf(Math.max(0, Math.min(total - 1, i)))),
    next: () => turnTo((turnRef.current?.target ?? view) + 1),
    prev: () => turnTo((turnRef.current?.target ?? view) - 1),
    pageElements: () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-page-index]") ?? []),
  }));

  // ── 끌어서 넘기기 ──
  const drag = useRef<{ id: number; x0: number; y0: number; forward: boolean; started: boolean; m0: Pt; c: Pt; lastX: number; lastT: number; vx: number } | null>(null);
  /** 화면 좌표 → 오른쪽 쪽 기준 좌표 (확대 배율 반영) */
  const local = (clientX: number, clientY: number): Pt => {
    const rect = bookRef.current!.getBoundingClientRect();
    const zoomed = rect.height / ph || 1;
    return { x: (clientX - rect.left) / zoomed - (twoUp ? pw : 0), y: (clientY - rect.top) / zoomed };
  };
  const isInteractive = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest("a, button, input, textarea, select, iframe, video, audio, [data-eb-block], [data-eb-goto], [data-eb-slide], [data-eb-draw]");

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    // 모서리 들림 힌트 중이면 멈추고 바로 끌기를 시작한다
    if (turnRef.current?.peek) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
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
    const m0 = local(e.clientX, e.clientY);
    // 위쪽 절반을 잡으면 위 모서리, 아니면 아래 모서리를 든다
    const cy = m0.y < ph / 2 ? 0 : ph;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, forward, started: false, m0, c: { x: forward ? pw : -pw, y: cy }, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
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
      cornerYRef.current = d.c.y;
      posRef.current = { ...d.c };
      setTurn({ lo, hi: lo + 1, target: d.forward ? view + 1 : view - 1 });
    }
    d.vx = (e.clientX - d.lastX) / Math.max(1, e.timeStamp - d.lastT);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    // 잡은 모서리가 손가락을 따라온다 (위아래는 덜 움직여 장이 책 밖으로 크게 휘지 않게)
    const m = local(e.clientX, e.clientY);
    paint({ x: d.c.x + m.x - d.m0.x, y: d.c.y + (m.y - d.m0.y) * 0.45 });
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
    const toHi = d.vx < -0.4 ? true : d.vx > 0.4 ? false : progressOf(posRef.current.x) >= 0.5;
    const landed = toHi ? t.hi : t.lo;
    if (landed !== view) {
      pageRef.current = firstOf(spreads[landed]);
      onFlipRef.current(pageRef.current);
    }
    setTurn({ ...t, target: landed });
    animate({ x: toHi ? -pw : pw, y: cornerYRef.current }, () => finish(), easeOut);
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
    cornerYRef.current = ph;
    posRef.current = { x: pw, y: ph };
    setTurn({ lo: view, hi: view + 1, target: view, peek: true });
    const done = () => {
      if (!turnRef.current?.peek) return; // 그사이 사용자가 넘기기 시작했다
      setTurn(null);
    };
    const corner = { x: pw, y: ph };
    const lifted = { x: pw * 0.86, y: ph - pw * 0.1 };
    requestAnimationFrame(() => turnRef.current?.peek && animate(lifted, () => turnRef.current?.peek && animate(corner, done, easeOut), easeOut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, spreads.length, animate, reduced, pw, ph]);

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
      <div data-page-index={i} className={active.has(i) ? "eb-page-active relative" : "relative"}>
        <PageRenderer
          page={book.pages[i]}
          theme={book.theme}
          size={book.size}
          scale={scale}
          pageNumber={showPageNumbers && showsPageNumber(book.pages[i].layoutId) ? i + 1 : undefined}
        />
        {renderOverlay && (
          <div className="absolute top-0 left-0 z-[1]" style={{ width: book.size.width, height: book.size.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            {renderOverlay(i)}
          </div>
        )}
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
          </div>
        )}

        {/* 오른쪽 고정 쪽 (넘기는 동안에는 다음 펼침의 오른쪽) */}
        <div className="absolute top-0 overflow-hidden" style={{ left: twoUp ? pw : 0, width: pw, height: ph }}>
          {page(staticRight)}
          {staticRight !== null && twoUp && gutter("right", !turn && staticLeft === null)}
        </div>

        {/* 넘어가는 장 — 오른쪽 쪽 자리에 두고, 말린 부분은 책 밖으로도 나갈 수 있게 overflow는 열어 둔다 */}
        {turn && (
          <div className="pointer-events-none absolute top-0 z-[3]" style={{ left: twoUp ? pw : 0, width: pw, height: ph }}>
            {/* 드러난 다음 쪽 위, 접힌 선 바로 옆 그림자 */}
            <div ref={underRef} aria-hidden className="absolute inset-0" style={{ clipPath: toClip([]) }}>
              <div ref={underShadeRef} className="absolute top-0 left-0 origin-top-left" style={{ background: "linear-gradient(to right, rgba(0,0,0,.42), rgba(0,0,0,.12) 45%, rgba(0,0,0,0))" }} />
            </div>
            {/* 앞면: 접힌 선 안쪽만 */}
            <div ref={frontRef} className="absolute inset-0 overflow-hidden" style={{ background: book.theme.background }}>
              {page(leafFront)}
              {twoUp && gutter("right")}
            </div>
            {/* 말린 뒷면: 접힌 선에 반사해 그린다 */}
            <div ref={backWrapRef} className="absolute inset-0" style={{ filter: "drop-shadow(0 0 10px rgba(0,0,0,.28))" }}>
              <div ref={backClipRef} className="absolute inset-0" style={{ clipPath: toClip([]) }}>
                <div ref={backPageRef} className="absolute top-0 left-0 overflow-hidden" style={{ width: pw, height: ph, transformOrigin: "0 0", background: book.theme.background }}>
                  {page(leafBack)}
                  {twoUp && gutter("left")}
                </div>
                <div
                  ref={backShadeRef}
                  aria-hidden
                  className="absolute top-0 left-0 origin-top-left"
                  style={{ background: "linear-gradient(to left, rgba(0,0,0,.22), rgba(255,255,255,.35) 12%, rgba(255,255,255,.08) 45%, rgba(0,0,0,.10))" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
