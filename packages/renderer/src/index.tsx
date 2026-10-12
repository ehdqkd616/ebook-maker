import type { CSSProperties } from "react";
import { getLayout, toPx, type Decoration } from "@ebook/layouts";
import type { Block, BookSize, Page, Theme } from "@ebook/schema";

// SPEC 9 — Page JSON → HTML. 에디터·뷰어·PDF가 모두 이 컴포넌트를 쓴다.
// 좌표는 항상 책 원본 px 기준이고, 화면 크기 맞춤은 바깥에서 scale로 처리한다.

export type PageRendererProps = {
  page: Page;
  theme: Theme;
  size: Pick<BookSize, "width" | "height">;
  /** 표시할 페이지 번호. 생략하면 그리지 않는다. */
  pageNumber?: number;
  /** 화면 맞춤 배율 (transform: scale). */
  scale?: number;
};

export function themeVars(theme: Theme): CSSProperties {
  return {
    "--eb-primary": theme.primary,
    "--eb-secondary": theme.secondary,
    "--eb-bg": theme.background,
    "--eb-text": theme.text,
    "--eb-heading-font": theme.headingFont,
    "--eb-body-font": theme.bodyFont,
  } as CSSProperties;
}

export function PageRenderer({ page, theme, size, pageNumber, scale = 1 }: PageRendererProps) {
  const decorations = getLayout(page.layoutId).decorations ?? [];
  return (
    <div className="eb-page-frame" style={{ width: size.width * scale, height: size.height * scale }}>
      <div
        className={`eb-page eb-layout-${page.layoutId}`}
        data-page-id={page.id}
        style={{
          ...themeVars(theme),
          width: size.width,
          height: size.height,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          background: page.background?.color ?? "var(--eb-bg)",
          backgroundImage: page.background?.imageUrl ? `url(${JSON.stringify(page.background.imageUrl)})` : undefined,
          backgroundSize: page.background?.imageUrl ? "cover" : undefined,
          backgroundPosition: page.background?.imageUrl ? "center" : undefined,
        }}
      >
        {decorations.map((d, i) => (
          <DecorationView key={i} decoration={d} size={size} />
        ))}
        {page.blocks.map((block) => (
          <BlockView key={block.id} block={block} />
        ))}
        {pageNumber !== undefined && <div className="eb-page-number">{pageNumber}</div>}
      </div>
    </div>
  );
}

function DecorationView({ decoration: d, size }: { decoration: Decoration; size: Pick<BookSize, "width" | "height"> }) {
  const { x, y, w, h } = toPx(d.box, size);
  const fill = d.fill === "primary" || d.fill === "secondary" ? `var(--eb-${d.fill})` : d.fill;
  return (
    <div
      className="eb-decoration"
      aria-hidden
      style={{ left: x, top: y, width: w, height: h, background: fill, borderRadius: d.kind === "ellipse" ? "50%" : 0 }}
    />
  );
}

/** 동영상 주소 → YouTube·Vimeo·파일 */
export function videoInfo(src: string): { kind: "youtube" | "vimeo"; id: string } | { kind: "file" } {
  const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/.exec(src);
  if (yt) return { kind: "youtube", id: yt[1] };
  const vm = /vimeo\.com\/(?:video\/)?(\d{5,12})/.exec(src);
  if (vm) return { kind: "vimeo", id: vm[1] };
  return { kind: "file" };
}

/** 팝업·전체화면 재생용 iframe 주소 */
export function videoEmbedUrl(src: string, autoplay = true) {
  const v = videoInfo(src);
  if (v.kind === "youtube") return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0${autoplay ? "&autoplay=1" : ""}`;
  if (v.kind === "vimeo") return `https://player.vimeo.com/video/${v.id}${autoplay ? "?autoplay=1" : ""}`;
  return null;
}

const PLAY_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden className="eb-icon">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);

function BlockView({ block }: { block: Block }) {
  if (block.hidden) return null;
  const anim = block.animation;
  const style: CSSProperties = {
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
    ...(anim ? { ["--eb-anim-delay" as string]: `${anim.delay}ms`, ["--eb-anim-dur" as string]: `${anim.duration}ms` } : {}),
    ...block.style,
  };
  const className = `eb-block eb-${block.type}${block.slot ? ` eb-slot-${block.slot}` : ""}${anim ? ` eb-anim eb-anim-${anim.type}` : ""}${block.action ? " eb-has-action" : ""}`;
  // 뷰어가 눌림을 처리할 수 있게 표시해 둔다 (page-flip은 a·button에 대한 클릭만 넘겨준다)
  const act = { "data-eb-block": block.id } as Record<string, string>;
  const content = renderContent(block, className, style);
  if (!block.action || ["button", "hotspot", "product", "video", "audio", "slideshow", "embed", "link"].includes(block.type)) return content;
  // 일반 블록에 동작이 붙으면 같은 자리에 투명한 버튼을 덮는다
  return (
    <>
      {content}
      <button
        type="button"
        className="eb-block eb-action-cover"
        style={{ left: block.x, top: block.y, width: block.w, height: block.h, transform: style.transform }}
        aria-label={actionLabel(block)}
        {...act}
      />
    </>
  );
}

function actionLabel(block: Block) {
  const a = block.action;
  if (!a) return "";
  if (a.type === "url") return `링크 열기: ${a.href}`;
  if (a.type === "page") return `${a.page}쪽으로 이동`;
  return a.title || "자세히 보기";
}

function renderContent(block: Block, className: string, style: CSSProperties) {
  const act = { "data-eb-block": block.id } as Record<string, string>;
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.data.level}` as "h1" | "h2" | "h3";
      return <Tag className={className} style={style}>{block.data.text}</Tag>;
    }
    case "paragraph":
      return (
        <div className={className} style={style}>
          {splitParagraphs(block.data.text).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      );
    case "list": {
      const Tag = block.data.ordered ? "ol" : "ul";
      return (
        <Tag className={className} style={style}>
          {block.data.items.map((item, i) => <li key={i}>{item}</li>)}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className={className} style={style}>
          <p>{block.data.text}</p>
          {block.data.cite && <cite>{block.data.cite}</cite>}
        </blockquote>
      );
    case "image":
      if (!block.data.src) {
        return (
          <div className={`${className} eb-image-empty`} style={style}>
            <span>이미지</span>
          </div>
        );
      }
      return <img className={className} style={{ ...style, objectFit: block.data.fit }} src={block.data.src} alt={block.data.alt} draggable={false} />;
    case "shape":
      return (
        <div
          className={className}
          style={{
            background: block.data.fill ?? "var(--eb-primary)",
            borderRadius: block.data.kind === "ellipse" ? "50%" : undefined,
            ...style,
            height: block.data.kind === "line" ? Math.max(2, Math.min(block.h, 6)) : block.h,
          }}
        />
      );
    case "audio":
      return (
        <button type="button" className={`${className} eb-interactive`} style={style} data-eb-audio={block.data.src} {...act}>
          <span className="eb-audio-icon">{PLAY_ICON}</span>
          <span className="eb-audio-title">{block.data.title || "오디오 재생"}</span>
        </button>
      );
    case "video": {
      const v = videoInfo(block.data.src);
      const poster = v.kind === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : undefined;
      return (
        <button type="button" className={`${className} eb-interactive`} style={style} aria-label="동영상 재생" {...act}>
          {poster ? (
            <img src={poster} alt="" className="eb-video-poster" draggable={false} />
          ) : v.kind === "file" && block.data.src ? (
            <video src={`${block.data.src}#t=0.1`} preload="metadata" muted className="eb-video-poster" />
          ) : (
            <span className="eb-video-empty">동영상</span>
          )}
          <span className="eb-video-play">{PLAY_ICON}</span>
        </button>
      );
    }
    case "slideshow": {
      const imgs = block.data.images;
      return (
        <div className={className} style={style} data-eb-slideshow={block.id} data-index="0" data-autoplay={block.data.autoplay || undefined}>
          <div className="eb-slides">
            {imgs.length === 0 && <div className="eb-image-empty eb-slide"><span>슬라이드쇼</span></div>}
            {imgs.map((im, i) => (
              <figure key={i} className="eb-slide">
                <img src={im.src} alt={im.caption ?? ""} style={{ objectFit: block.data.fit }} draggable={false} />
                {im.caption && <figcaption>{im.caption}</figcaption>}
              </figure>
            ))}
          </div>
          {imgs.length > 1 && (
            <>
              <button type="button" className="eb-slide-nav eb-slide-prev" data-eb-slide="prev" aria-label="이전 사진">‹</button>
              <button type="button" className="eb-slide-nav eb-slide-next" data-eb-slide="next" aria-label="다음 사진">›</button>
              <div className="eb-slide-dots">
                {imgs.map((_, i) => <span key={i} className={i === 0 ? "on" : ""} />)}
              </div>
            </>
          )}
        </div>
      );
    }
    case "product":
      return (
        <button type="button" className={`${className} eb-interactive`} style={style} aria-label={`상품: ${block.data.name}`} {...act}>
          <span className="eb-product-pin">
            <svg viewBox="0 0 24 24" aria-hidden className="eb-icon">
              <path d="M6 7h12l-1 13H7L6 7Z M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      );
    case "button":
      return (
        <button type="button" className={`${className} eb-interactive eb-button-${block.data.variant}`} style={style} {...act}>
          {block.data.text}
        </button>
      );
    case "hotspot":
      return (
        <button type="button" className={`${className} eb-interactive${block.data.pulse ? " eb-hotspot-pulse" : ""}`} style={style} aria-label={block.data.label || actionLabel(block) || "자세히 보기"} {...act}>
          {block.data.pulse && <span className="eb-hotspot-dot" />}
        </button>
      );
    case "embed": {
      const url = /^https:\/\//i.test(block.data.url) ? block.data.url : undefined;
      return url ? (
        <iframe
          className={className}
          style={{ ...style, border: 0 }}
          src={url}
          title="삽입한 웹 콘텐츠"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      ) : (
        <div className={`${className} eb-image-empty`} style={style}><span>웹 콘텐츠 (https 주소)</span></div>
      );
    }
    case "link":
      return (
        <a className={className} style={style} href={safeHref(block.data.href)} target="_blank" rel="noopener noreferrer" {...act}>
          {block.data.text}
        </a>
      );
    case "toc":
      return (
        <ol className={className} style={style}>
          {block.data.entries.length === 0 && <li className="eb-toc-empty">챕터를 추가하면 목차가 채워집니다.</li>}
          {block.data.entries.map((e, i) => (
            <li key={i}>
              <button type="button" className="eb-toc-link" data-eb-goto={e.page}>
                <span className="eb-toc-no">{String(i + 1).padStart(2, "0")}</span>
                <span className="eb-toc-title">{e.title}</span>
                <span className="eb-toc-dots" aria-hidden />
                <span className="eb-toc-page">{e.page}</span>
              </button>
            </li>
          ))}
        </ol>
      );
  }
}

/** 링크는 http(s)·mailto만 (javascript: 같은 주소 차단) */
function safeHref(href: string) {
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : undefined;
}

function splitParagraphs(text: string) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
