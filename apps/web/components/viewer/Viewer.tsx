"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  LayoutGrid,
  Maximize,
  Minimize,
  Pause,
  Play,
  Search,
  Share2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { bookToc } from "@ebook/layouts";
import { DEFAULT_VIEWER, ViewerSettings, type Block, type Book } from "@ebook/schema";
import { BookStage, PERSPECTIVE_RATIO, type StageHandle } from "./BookStage";
import { ScrollStage, SlideStage } from "./PagedStage";
import { ShareDialog } from "./ShareDialog";
import { playFlipSound } from "./sound";
import { ViewerPopup, type PopupContent } from "./ViewerPopup";
import { ViewerSidebar, type SidebarTab } from "./ViewerSidebar";

// 플립북 뷰어 — FlipHTML5·Heyzine·Flipsnack 뷰어에서 공통으로 보이는 기능:
// 책장 넘김/슬라이드/스크롤, 썸네일·목차·검색·책갈피, 확대·이동, 자동 넘김, 넘김 소리·배경 음악,
// 공유(주소·QR·SNS·임베드), 다운로드, 전체 화면, 쪽 주소(?page=), 이어 보기, 블록 동작(링크·쪽 이동·팝업·
// 동영상·오디오·슬라이드쇼·상품 태그), 등장 애니메이션, 열람 통계

const PADDING = 28;
const ZOOMS = [1, 1.5, 2, 3] as const;

export type ViewerProps = {
  book: Book;
  /** 공개본 주소 (통계·공유·다운로드에 쓴다). 미리보기면 없음 */
  slug?: string;
  backHref?: string;
  embed?: boolean;
  initialPage?: number;
};

export function Viewer({ book, slug, backHref, embed = false, initialPage }: ViewerProps) {
  const settings = useMemo(() => ViewerSettings.parse(book.viewer ?? DEFAULT_VIEWER), [book.viewer]);
  const btn = settings.buttons;
  const total = book.pages.length;
  const storeKey = slug ?? `draft:${book.id}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [spread, setSpread] = useState(true);
  const [current, setCurrent] = useState(() => Math.max(0, Math.min(total - 1, (initialPage ?? 1) - 1)));
  const [sidebar, setSidebar] = useState<SidebarTab | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [popup, setPopup] = useState<PopupContent | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(settings.flipSound);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<{ el: HTMLAudioElement; button: HTMLElement } | null>(null);
  const toc = useMemo(() => bookToc(book), [book]);
  const blocks = useMemo(() => new Map<string, Block>(book.pages.flatMap((p) => p.blocks.map((b) => [b.id, b] as const))), [book]);

  // ── 통계 ──
  const track = useCallback(
    (event: "view" | "page" | "click", extra: Record<string, unknown> = {}) => {
      if (!slug) return;
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, event, ...extra }),
        keepalive: true,
      }).catch(() => {});
    },
    [slug],
  );
  const firstPage = useRef(current);
  useEffect(() => {
    track("view");
    track("page", { page: firstPage.current + 1 }); // 처음 펼친 쪽도 읽은 쪽으로 센다
  }, [track]);

  // ── 이어 보기·책갈피 (이 브라우저에만 저장) ──
  useEffect(() => {
    try {
      setBookmarks(JSON.parse(localStorage.getItem(`eb-bm:${storeKey}`) ?? "[]"));
      const last = Number(localStorage.getItem(`eb-last:${storeKey}`));
      if (!initialPage && last > 1 && last <= total) {
        setCurrent(last - 1);
        setToast(`지난번에 보던 ${last}쪽부터 이어서 보여 드려요.`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`eb-last:${storeKey}`, String(current + 1));
    } catch {}
  }, [current, storeKey]);
  const toggleBookmark = () => {
    const next = bookmarks.includes(current) ? bookmarks.filter((p) => p !== current) : [...bookmarks, current].sort((a, b) => a - b);
    setBookmarks(next);
    try {
      localStorage.setItem(`eb-bm:${storeKey}`, JSON.stringify(next));
    } catch {}
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── 무대 크기 → 배율 ──
  useEffect(() => {
    const box = stageBoxRef.current!;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const cw = box.clientWidth - PADDING * 2;
      // hard 넘김은 3D로 회전하면서 잠깐 커지므로(최대 약 1/PERSPECTIVE_RATIO) 위아래 여유를 남긴다
      const ch = (box.clientHeight - PADDING * 2) / (settings.mode === "flip" ? PERSPECTIVE_RATIO / (PERSPECTIVE_RATIO - 1) : 1);
      const wide = cw > ch * 1.15 && settings.mode !== "scroll";
      const s =
        settings.mode === "scroll"
          ? Math.min(cw / book.size.width, 1.2)
          : Math.min(cw / (wide ? book.size.width * 2 : book.size.width), ch / book.size.height);
      setSpread(wide);
      setScale(Math.max(0.1, Math.floor(s * 100) / 100));
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 120);
    });
    measure();
    ro.observe(box);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [book.size, settings.mode]);

  // ── 쪽이 바뀔 때: 소리·통계·애니메이션 ──
  const lastPage = useRef(current);
  const onFlip = useCallback(
    (i: number) => {
      setCurrent(i);
      if (i !== lastPage.current) {
        if (soundOn && settings.mode !== "scroll") playFlipSound();
        track("page", { page: i + 1 });
        lastPage.current = i;
      }
    },
    [soundOn, settings.mode, track],
  );

  useEffect(() => {
    const els = stageRef.current?.pageElements() ?? [];
    const visible = new Set([current, ...(spread && settings.mode !== "scroll" && current > 0 ? [current + 1] : [])]);
    for (const el of els) {
      const page = el.querySelector(".eb-page");
      const on = visible.has(Number(el.dataset.pageIndex));
      if (page && on !== page.classList.contains("eb-page-active")) page.classList.toggle("eb-page-active", on);
    }
  }, [current, spread, scale, settings.mode]);

  const go = (i: number) => stageRef.current?.go(i);
  const next = () => stageRef.current?.next();
  const prev = () => stageRef.current?.prev();

  // ── 자동 넘김 ──
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (current >= total - 1) setPlaying(false);
      else next();
    }, (settings.autoplaySeconds || 4) * 1000);
    return () => clearInterval(t);
  }, [playing, current, total, settings.autoplaySeconds]);

  // ── 배경 음악 ──
  useEffect(() => {
    if (!settings.music) return;
    const a = new Audio(settings.music);
    a.loop = true;
    a.volume = 0.5;
    musicRef.current = a;
    return () => {
      a.pause();
      musicRef.current = null;
    };
  }, [settings.music]);
  useEffect(() => {
    const a = musicRef.current;
    if (!a) return;
    if (soundOn) void a.play().catch(() => {});
    else a.pause();
  }, [soundOn]);
  // 브라우저는 사용자가 한 번 눌러야 소리를 내준다 → 첫 클릭 때 음악 시작
  useEffect(() => {
    if (!settings.music) return;
    const start = () => soundOn && void musicRef.current?.play().catch(() => {});
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [settings.music, soundOn]);

  // ── 전체 화면 ──
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  // ── 확대 ──
  const setZoomLevel = (z: number) => {
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  };
  const zoomIn = () => setZoomLevel(ZOOMS.find((z) => z > zoom) ?? zoom);
  const zoomOut = () => setZoomLevel([...ZOOMS].reverse().find((z) => z < zoom) ?? 1);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // ── 키보드 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "Escape") {
        setPopup(null);
        setShareOpen(false);
        setSidebar(null);
        setZoomLevel(1);
      } else if (e.key.toLowerCase() === "f" && btn.fullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── 페이지 안 요소 누르기 (복제된 DOM이라 위임으로 처리) ──
  useEffect(() => {
    const root = rootRef.current!;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const gotoEl = t.closest<HTMLElement>("[data-eb-goto]");
      if (gotoEl) {
        e.preventDefault();
        go(Number(gotoEl.dataset.ebGoto) - 1);
        return;
      }
      const slideBtn = t.closest<HTMLElement>("[data-eb-slide]");
      if (slideBtn) {
        e.preventDefault();
        const show = slideBtn.closest<HTMLElement>("[data-eb-slideshow]");
        if (show) stepSlide(show, slideBtn.dataset.ebSlide === "next" ? 1 : -1);
        return;
      }
      const el = t.closest<HTMLElement>("[data-eb-block]");
      if (!el) return;
      const block = blocks.get(el.dataset.ebBlock ?? "");
      if (!block) return;
      if (block.type === "link" && !block.action) {
        track("click", { block: block.id, page: current + 1 });
        return; // <a>가 새 창으로 연다
      }
      e.preventDefault();
      track("click", { block: block.id, page: current + 1 });
      if (block.type === "audio") return toggleAudio(el, block.data.src);
      if (block.type === "video" && !block.action) return setPopup({ kind: "video", src: block.data.src });
      if (block.type === "product" && !block.action) return setPopup({ kind: "product", data: block.data });
      const a = block.action;
      if (!a) return;
      if (a.type === "url") window.open(a.href, "_blank", "noopener,noreferrer");
      else if (a.type === "page") go(a.page - 1);
      else setPopup({ kind: "info", title: a.title, text: a.text, image: a.image, video: a.video });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  });

  function stepSlide(show: HTMLElement, d: number) {
    const n = show.querySelectorAll(".eb-slide").length;
    if (n < 2) return;
    const i = (Number(show.dataset.index ?? 0) + d + n) % n;
    show.dataset.index = String(i);
    const track = show.querySelector<HTMLElement>(".eb-slides");
    if (track) track.style.transform = `translateX(-${i * 100}%)`;
    show.querySelectorAll(".eb-slide-dots span").forEach((dot, k) => dot.classList.toggle("on", k === i));
  }
  // 자동으로 넘어가는 슬라이드쇼
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      rootRef.current?.querySelectorAll<HTMLElement>(".eb-page-active [data-eb-slideshow][data-autoplay]").forEach((show) => {
        const every = Number(show.dataset.autoplay) * 1000;
        const last = Number(show.dataset.last ?? 0);
        if (now - last >= every) {
          if (last) stepSlide(show, 1);
          show.dataset.last = String(now);
        }
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  function toggleAudio(button: HTMLElement, src: string) {
    const cur = audioRef.current;
    if (cur && cur.button === button) {
      if (cur.el.paused) void cur.el.play();
      else cur.el.pause();
      button.classList.toggle("eb-playing", !cur.el.paused);
      return;
    }
    cur?.el.pause();
    cur?.button.classList.remove("eb-playing");
    const el = new Audio(src);
    el.onended = () => button.classList.remove("eb-playing");
    audioRef.current = { el, button };
    void el.play().then(() => button.classList.add("eb-playing")).catch(() => setToast("오디오를 재생하지 못했어요."));
  }
  useEffect(() => () => audioRef.current?.el.pause(), []);

  const v = settings;
  const bg = v.backgroundImage
    ? { backgroundImage: `url(${JSON.stringify(v.backgroundImage)})`, backgroundSize: "cover", backgroundPosition: "center" }
    : v.background
      ? { background: v.background }
      : undefined;
  const marked = bookmarks.includes(current);
  const pageLabel = spread && settings.mode !== "scroll" && current > 0 && current < total - 1 ? `${current + 1}-${current + 2}` : `${current + 1}`;

  return (
    <div
      ref={rootRef}
      className="eb-anim-ready relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#3b3550,#16141f_70%)] text-white select-none"
      style={bg}
    >
      {/* 위: 로고·제목 */}
      {!embed && (v.logo || backHref || book.title) && (
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex items-center gap-3 p-4">
          {backHref && (
            <a href={backHref} className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-black/30 px-3 py-2 text-sm backdrop-blur hover:bg-black/45">
              <ArrowLeft className="size-4" /> 편집
            </a>
          )}
          {v.logo && (
            <a href={v.logoHref || undefined} target="_blank" rel="noopener noreferrer" className="pointer-events-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.logo} alt="로고" className="h-9 max-w-40 object-contain" />
            </a>
          )}
          <span className="truncate text-sm font-medium text-white/70 [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{book.title}</span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {sidebar && (
          <ViewerSidebar
            book={book}
            tab={sidebar}
            setTab={setSidebar}
            toc={toc}
            current={current}
            bookmarks={bookmarks}
            enabled={btn}
            onGo={(i) => {
              go(i);
              setFlash(true);
              setTimeout(() => setFlash(false), 900);
              if (window.innerWidth < 768) setSidebar(null);
            }}
            onClose={() => setSidebar(null)}
          />
        )}

        <div ref={stageBoxRef} className="relative min-w-0 flex-1 overflow-hidden" style={{ padding: settings.mode === "scroll" ? 0 : PADDING }}>
          <div
            className={`h-full w-full transition-transform duration-200 ${flash ? "brightness-110" : ""}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
          >
            {scale !== null &&
              (settings.mode === "flip" ? (
                <BookStage book={book} scale={scale} spread={spread} startPage={current} showPageNumbers={v.showPageNumbers} onFlip={onFlip} handleRef={stageRef} />
              ) : settings.mode === "slide" ? (
                <SlideStage book={book} scale={scale} current={current} spread={spread} showPageNumbers={v.showPageNumbers} onFlip={onFlip} handleRef={stageRef} />
              ) : (
                <ScrollStage book={book} scale={scale} current={current} showPageNumbers={v.showPageNumbers} onFlip={onFlip} handleRef={stageRef} />
              ))}
          </div>
          {/* 확대했을 때는 끌어서 옮긴다 (넘김은 잠시 멈춤) */}
          {zoom > 1 && (
            <div
              className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              }}
              onPointerMove={(e) => {
                const s = panStart.current;
                if (s) setPan({ x: s.px + e.clientX - s.x, y: s.py + e.clientY - s.y });
              }}
              onPointerUp={() => (panStart.current = null)}
              onDoubleClick={() => setZoomLevel(1)}
              onWheel={(e) => setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))}
            />
          )}
          {/* 옆 화살표 */}
          {settings.mode !== "scroll" && zoom === 1 && (
            <>
              <button type="button" aria-label="이전 페이지" disabled={current === 0} onClick={prev} className="absolute top-1/2 left-3 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-0 md:grid">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" aria-label="다음 페이지" disabled={current >= total - 1} onClick={next} className="absolute top-1/2 right-3 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-0 md:grid">
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 아래 도구 막대 */}
      <div className="relative z-20 flex shrink-0 justify-center px-2 pb-3">
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/35 px-1.5 py-1 text-sm text-white/85 shadow-2xl backdrop-blur-xl">
          {(btn.thumbnails || btn.toc || btn.search || btn.bookmarks) && (
            <TB label="목록·검색" active={!!sidebar} onClick={() => setSidebar(sidebar ? null : btn.thumbnails ? "thumbs" : btn.toc ? "toc" : btn.search ? "search" : "bookmarks")}>
              <LayoutGrid className="size-[18px]" />
            </TB>
          )}
          {btn.search && (
            <TB label="검색" onClick={() => setSidebar("search")} className="hidden sm:grid">
              <Search className="size-[18px]" />
            </TB>
          )}
          <Sep />
          <TB label="처음으로" disabled={current === 0} onClick={() => go(0)} className="hidden sm:grid"><ChevronsLeft className="size-[18px]" /></TB>
          <TB label="이전 페이지" disabled={current === 0} onClick={prev}><ChevronLeft className="size-5" /></TB>
          <label className="flex items-center gap-1 px-1 tabular-nums">
            <input
              aria-label="쪽 번호로 이동"
              key={current}
              defaultValue={pageLabel}
              className="w-14 rounded-lg bg-white/10 px-1.5 py-1 text-center outline-none focus:bg-white/20"
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt((e.target as HTMLInputElement).value, 10);
                  if (n >= 1 && n <= total) go(n - 1);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <span className="text-white/45">/ {total}</span>
          </label>
          <TB label="다음 페이지" disabled={current >= total - 1} onClick={next}><ChevronRight className="size-5" /></TB>
          <TB label="끝으로" disabled={current >= total - 1} onClick={() => go(total - 1)} className="hidden sm:grid"><ChevronsRight className="size-[18px]" /></TB>
          <Sep />
          {btn.bookmarks && (
            <TB label={marked ? "책갈피 빼기" : "이 쪽에 책갈피"} active={marked} onClick={toggleBookmark}>
              {marked ? <BookmarkCheck className="size-[18px]" /> : <Bookmark className="size-[18px]" />}
            </TB>
          )}
          {btn.zoom && settings.mode !== "scroll" && (
            <>
              <TB label="축소" disabled={zoom === 1} onClick={zoomOut} className="hidden sm:grid"><ZoomOut className="size-[18px]" /></TB>
              <TB label="확대" disabled={zoom === ZOOMS.at(-1)} onClick={zoomIn}><ZoomIn className="size-[18px]" /></TB>
            </>
          )}
          {btn.autoplay && settings.mode !== "scroll" && (
            <TB label={playing ? "자동 넘김 멈추기" : "자동 넘김"} active={playing} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="size-[18px]" /> : <Play className="size-[18px]" />}
            </TB>
          )}
          {btn.sound && (settings.flipSound || settings.music) && (
            <TB label={soundOn ? "소리 끄기" : "소리 켜기"} onClick={() => setSoundOn((s) => !s)}>
              {soundOn ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
            </TB>
          )}
          {btn.share && slug && (
            <TB label="공유" onClick={() => setShareOpen(true)}><Share2 className="size-[18px]" /></TB>
          )}
          {v.allowDownload && slug && (
            <a href={`/b/${slug}/print`} target="_blank" rel="noreferrer" aria-label="PDF로 저장·인쇄" title="PDF로 저장·인쇄" className="grid size-9 place-items-center rounded-xl transition hover:bg-white/10">
              <Download className="size-[18px]" />
            </a>
          )}
          {btn.fullscreen && (
            <TB label="전체 화면" onClick={toggleFullscreen}>{fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}</TB>
          )}
          {embed && slug && (
            <a href={`/b/${slug}`} target="_blank" rel="noreferrer" className="ml-1 rounded-xl px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white">새 창</a>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute top-16 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2.5 text-sm shadow-xl backdrop-blur">
          {toast}{" "}
          {toast.includes("이어서") && (
            <button type="button" className="ml-2 underline" onClick={() => { go(0); setToast(""); }}>처음부터</button>
          )}
        </div>
      )}
      {shareOpen && slug && <ShareDialog slug={slug} title={book.title} page={current + 1} onClose={() => setShareOpen(false)} />}
      {popup && <ViewerPopup content={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}

function TB({ label, children, onClick, disabled, active, className = "grid" }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`${className} size-9 shrink-0 place-items-center rounded-xl transition hover:bg-white/10 disabled:opacity-30 ${active ? "bg-white/15 text-white" : ""}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />;
