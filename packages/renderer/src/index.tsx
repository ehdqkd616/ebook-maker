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
          backgroundImage: page.background?.imageUrl ? `url(${page.background.imageUrl})` : undefined,
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

function BlockView({ block }: { block: Block }) {
  const style: CSSProperties = {
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
    ...block.style,
  };
  const className = `eb-block eb-${block.type}${block.slot ? ` eb-slot-${block.slot}` : ""}`;

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
      return <img className={className} style={{ ...style, objectFit: block.data.fit }} src={block.data.src} alt={block.data.alt} />;
    case "shape":
      return (
        <div
          className={className}
          style={{
            ...style,
            background: block.data.fill ?? "var(--eb-primary)",
            borderRadius: block.data.kind === "ellipse" ? "50%" : undefined,
            height: block.data.kind === "line" ? 2 : block.h,
          }}
        />
      );
    case "audio":
      return <audio className={className} style={style} src={block.data.src} controls />;
    case "video":
      return <video className={className} style={style} src={block.data.src} controls />;
    case "link":
      return (
        <a className={className} style={style} href={block.data.href} target="_blank" rel="noopener noreferrer">
          {block.data.text}
        </a>
      );
  }
}

function splitParagraphs(text: string) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
