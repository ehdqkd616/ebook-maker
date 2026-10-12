"use client";

import { useMemo } from "react";
import {
  applyLayout,
  createPage,
  FONTS,
  LAYOUT_LIST,
  resizeBook,
  THEME_PRESETS,
  type FontKey,
} from "@ebook/layouts";
import { SIZE_PRESETS, type Block, type Book, type Page, type SizePreset } from "@ebook/schema";
import { PageThumb } from "@/components/PageThumb";
import { blockText, withText } from "./Canvas";
import { deleteBlock, duplicateBlock, reorderBlock, setStyle, updateBlock, updatePage } from "./ops";

type Update = (fn: (b: Book) => Book, mergeKey?: string) => void;
export type InspectorTab = "block" | "page" | "book";

const SIZE_LABEL: Record<SizePreset, string> = { A4: "A4 세로", LETTER: "레터", SQUARE: "정사각형", LANDSCAPE: "가로형" };
const TYPE_LABEL: Record<Block["type"], string> = {
  heading: "제목", paragraph: "본문", list: "목록", quote: "인용", image: "이미지", shape: "도형", audio: "오디오", video: "비디오", link: "링크", toc: "목차",
};

/** <input type="color">는 #rrggbb만 받는다 */
const toHex6 = (c: string | undefined, fallback = "#000000") => {
  if (!c) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c.slice(1).split("").map((x) => x + x).join("")}`;
  if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7);
  return fallback;
};

export function Inspector({
  book,
  page,
  block,
  tab,
  setTab,
  update,
  onSelect,
  onPickImage,
}: {
  book: Book;
  page: Page;
  block: Block | null;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  update: Update;
  onSelect: (id: string | null) => void;
  onPickImage: (target: { blockId: string } | "background") => void;
}) {
  const active = tab === "block" && !block ? "page" : tab;
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex border-b border-neutral-200 text-sm">
        {(["block", "page", "book"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t === "block" && !block}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 font-medium disabled:opacity-30 ${active === t ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-500 hover:text-neutral-800"}`}
          >
            {t === "block" ? "블록" : t === "page" ? "페이지" : "책"}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 text-sm">
        {active === "block" && block && <BlockPanel book={book} page={page} block={block} update={update} onSelect={onSelect} onPickImage={onPickImage} />}
        {active === "page" && <PagePanel book={book} page={page} update={update} onPickImage={onPickImage} />}
        {active === "book" && <BookPanel book={book} update={update} />}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold tracking-wide text-neutral-500">{title}</h3>
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

const small = "w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900";

function ColorField({ value, fallback, onChange, onReset }: { value?: string; fallback: string; onChange: (c: string) => void; onReset?: () => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <input type="color" className="h-7 w-10 cursor-pointer rounded border border-neutral-300" value={toHex6(value, fallback)} onChange={(e) => onChange(e.target.value)} />
      {onReset && value && (
        <button type="button" className="text-xs text-neutral-500 underline" onClick={onReset}>기본값</button>
      )}
    </span>
  );
}

// ── 블록 ─────────────────────────────────────────────

function BlockPanel({
  book, page, block, update, onSelect, onPickImage,
}: {
  book: Book; page: Page; block: Block; update: Update; onSelect: (id: string | null) => void; onPickImage: (t: { blockId: string }) => void;
}) {
  const set = (fn: (b: Block) => Block, key?: string) => update((bk) => updateBlock(bk, page.id, block.id, fn), key);
  const style = (k: string, v: string | number | undefined) => set((b) => setStyle(b, k, v), `style:${block.id}:${k}`);
  const isText = ["heading", "paragraph", "list", "quote", "link", "toc"].includes(block.type);

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold">{TYPE_LABEL[block.type]}</span>
        {block.slot && <span className="text-xs text-neutral-400">레이아웃 자리: {block.slot}</span>}
      </div>

      {(block.type === "heading" || block.type === "paragraph" || block.type === "list" || block.type === "quote") && (
        <Section title="내용">
          <textarea
            className={`${small} min-h-28 leading-relaxed`}
            value={blockText(block)}
            onChange={(e) => set((b) => withText(b, e.target.value), `text:${block.id}`)}
          />
          {block.type === "list" && (
            <Row label="번호 매기기">
              <input type="checkbox" checked={block.data.ordered} onChange={(e) => set((b) => (b.type === "list" ? { ...b, data: { ...b.data, ordered: e.target.checked } } : b))} />
            </Row>
          )}
          {block.type === "heading" && (
            <Row label="크기 단계">
              <select className={small} value={block.data.level} onChange={(e) => set((b) => (b.type === "heading" ? { ...b, data: { ...b.data, level: Number(e.target.value) } } : b))}>
                <option value={1}>큰 제목</option>
                <option value={2}>중간 제목</option>
                <option value={3}>작은 제목</option>
              </select>
            </Row>
          )}
          {block.type === "quote" && (
            <Row label="출처">
              <input className={small} value={block.data.cite ?? ""} onChange={(e) => set((b) => (b.type === "quote" ? { ...b, data: { ...b.data, cite: e.target.value } } : b), `cite:${block.id}`)} />
            </Row>
          )}
          {block.type === "list" && <p className="text-xs text-neutral-400">한 줄에 항목 하나씩 적어요.</p>}
        </Section>
      )}

      {block.type === "toc" && (
        <Section title="목차">
          <p className="text-neutral-500">챕터 시작 페이지의 제목과 쪽 번호로 자동으로 채워집니다. 페이지 순서를 바꾸면 함께 바뀌어요.</p>
        </Section>
      )}

      {block.type === "link" && (
        <Section title="링크">
          <input className={small} value={block.data.text} placeholder="보이는 글자" onChange={(e) => set((b) => withText(b, e.target.value), `text:${block.id}`)} />
          <input className={small} value={block.data.href} placeholder="https://" onChange={(e) => set((b) => (b.type === "link" ? { ...b, data: { ...b.data, href: e.target.value } } : b), `href:${block.id}`)} />
        </Section>
      )}

      {block.type === "image" && (
        <Section title="이미지">
          <button type="button" className="btn" onClick={() => onPickImage({ blockId: block.id })}>{block.data.src ? "이미지 바꾸기" : "이미지 올리기"}</button>
          <input
            className={small}
            placeholder="또는 이미지 주소 (https://…)"
            value={block.data.src.startsWith("/api/files/") ? "" : block.data.src}
            onChange={(e) => set((b) => (b.type === "image" ? { ...b, data: { ...b.data, src: e.target.value.trim() } } : b), `src:${block.id}`)}
          />
          <Row label="맞춤">
            <select className={small} value={block.data.fit} onChange={(e) => set((b) => (b.type === "image" ? { ...b, data: { ...b.data, fit: e.target.value as "cover" | "contain" } } : b))}>
              <option value="cover">채우기 (잘림)</option>
              <option value="contain">전체 보이기</option>
            </select>
          </Row>
          <Row label="대체 텍스트">
            <input className={small} value={block.data.alt} onChange={(e) => set((b) => (b.type === "image" ? { ...b, data: { ...b.data, alt: e.target.value } } : b), `alt:${block.id}`)} />
          </Row>
          <Row label="모서리 둥글게">
            <input type="range" min={0} max={60} value={Number(block.style?.borderRadius ?? 0)} onChange={(e) => style("borderRadius", Number(e.target.value) || undefined)} />
          </Row>
        </Section>
      )}

      {block.type === "shape" && (
        <Section title="도형">
          <Row label="모양">
            <select className={small} value={block.data.kind} onChange={(e) => set((b) => (b.type === "shape" ? { ...b, data: { ...b.data, kind: e.target.value as "rect" | "ellipse" | "line" } } : b))}>
              <option value="rect">사각형</option>
              <option value="ellipse">원</option>
              <option value="line">선</option>
            </select>
          </Row>
          <Row label="채우기 색">
            <ColorField
              value={block.data.fill}
              fallback={book.theme.primary}
              onChange={(c) => set((b) => (b.type === "shape" ? { ...b, data: { ...b.data, fill: c } } : b), `fill:${block.id}`)}
              onReset={() => set((b) => (b.type === "shape" ? { ...b, data: { kind: b.data.kind } } : b))}
            />
          </Row>
          <Row label="모서리 둥글게">
            <input type="range" min={0} max={80} value={Number(block.style?.borderRadius ?? 0)} onChange={(e) => style("borderRadius", Number(e.target.value) || undefined)} />
          </Row>
        </Section>
      )}

      {isText && (
        <Section title="글자">
          <Row label="크기 (px)">
            <input
              type="number"
              min={8}
              max={160}
              className={`${small} w-24`}
              placeholder="기본"
              value={block.style?.fontSize ?? ""}
              onChange={(e) => style("fontSize", e.target.value ? Math.min(160, Math.max(8, Number(e.target.value))) : undefined)}
            />
          </Row>
          <Row label="색">
            <ColorField value={block.style?.color as string | undefined} fallback={book.theme.text} onChange={(c) => style("color", c)} onReset={() => style("color", undefined)} />
          </Row>
          <div className="flex gap-1">
            {(["left", "center", "right", "justify"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`btn flex-1 px-0 ${block.style?.textAlign === a ? "border-neutral-900 bg-neutral-100" : ""}`}
                onClick={() => style("textAlign", block.style?.textAlign === a ? undefined : a)}
              >
                {{ left: "왼쪽", center: "가운데", right: "오른쪽", justify: "양쪽" }[a]}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button type="button" className={`btn flex-1 font-bold ${block.style?.fontWeight === 700 ? "border-neutral-900 bg-neutral-100" : ""}`} onClick={() => style("fontWeight", block.style?.fontWeight === 700 ? undefined : 700)}>굵게</button>
            <button type="button" className={`btn flex-1 italic ${block.style?.fontStyle === "italic" ? "border-neutral-900 bg-neutral-100" : ""}`} onClick={() => style("fontStyle", block.style?.fontStyle === "italic" ? undefined : "italic")}>기울임</button>
            <button type="button" className={`btn flex-1 underline ${block.style?.textDecoration === "underline" ? "border-neutral-900 bg-neutral-100" : ""}`} onClick={() => style("textDecoration", block.style?.textDecoration === "underline" ? undefined : "underline")}>밑줄</button>
          </div>
          <Row label="줄 간격">
            <select className={`${small} w-28`} value={String(block.style?.lineHeight ?? "")} onChange={(e) => style("lineHeight", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">기본</option>
              {[1.2, 1.4, 1.6, 1.8, 2.0, 2.4].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Row>
          <Row label="배경색">
            <ColorField value={block.style?.background as string | undefined} fallback="#ffffff" onChange={(c) => style("background", c)} onReset={() => style("background", undefined)} />
          </Row>
        </Section>
      )}

      <Section title="위치·크기 (px)">
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <span className="w-4 text-neutral-500">{k.toUpperCase()}</span>
              <input
                type="number"
                className={small}
                value={block[k]}
                onChange={(e) => set((b) => ({ ...b, [k]: Math.max(k === "w" || k === "h" ? 1 : -5000, Math.round(Number(e.target.value) || 0)) }), `pos:${block.id}:${k}`)}
              />
            </label>
          ))}
        </div>
        <Row label="회전 (°)">
          <input type="number" className={`${small} w-24`} value={block.rotation ?? 0} onChange={(e) => set((b) => ({ ...b, rotation: Number(e.target.value) || undefined }), `rot:${block.id}`)} />
        </Row>
        <Row label="투명도">
          <input type="range" min={10} max={100} value={Math.round(Number(block.style?.opacity ?? 1) * 100)} onChange={(e) => style("opacity", Number(e.target.value) >= 100 ? undefined : Number(e.target.value) / 100)} />
        </Row>
      </Section>

      <Section title="배치">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className="btn" onClick={() => update((bk) => reorderBlock(bk, page.id, block.id, "front"))}>맨 앞으로</button>
          <button type="button" className="btn" onClick={() => update((bk) => reorderBlock(bk, page.id, block.id, "back"))}>맨 뒤로</button>
          <button type="button" className="btn" onClick={() => update((bk) => ({ ...bk, pages: bk.pages.map((p) => (p.id === page.id ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, x: Math.round((bk.size.width - b.w) / 2) } : b)) } : p)) }))}>가로 가운데</button>
          <button type="button" className="btn" onClick={() => update((bk) => ({ ...bk, pages: bk.pages.map((p) => (p.id === page.id ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, y: Math.round((bk.size.height - b.h) / 2) } : b)) } : p)) }))}>세로 가운데</button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              let id: string | null = null;
              update((bk) => {
                const r = duplicateBlock(bk, page.id, block.id);
                id = r.id;
                return r.book;
              });
              if (id) onSelect(id);
            }}
          >
            복제
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              update((bk) => deleteBlock(bk, page.id, block.id));
              onSelect(null);
            }}
          >
            삭제
          </button>
        </div>
      </Section>
    </>
  );
}

// ── 페이지 ───────────────────────────────────────────

function PagePanel({ book, page, update, onPickImage }: { book: Book; page: Page; update: Update; onPickImage: (t: "background") => void }) {
  const samples = useMemo(() => LAYOUT_LIST.map((l) => ({ layout: l, page: createPage(l.id, book.size) })), [book.size]);
  return (
    <>
      <Section title="레이아웃">
        <p className="text-xs text-neutral-500">같은 내용을 다른 틀에 다시 배치해요. 맞는 자리가 없는 블록은 그대로 둡니다.</p>
        <div className="grid grid-cols-3 gap-2">
          {samples.map(({ layout, page: sample }) => (
            <button
              key={layout.id}
              type="button"
              title={layout.name}
              onClick={() =>
                layout.id !== page.layoutId &&
                update((bk) => updatePage(bk, page.id, (p) => applyLayout(p, layout.id, bk.size, { body: bk.theme.bodyFont, heading: bk.theme.headingFont })))
              }
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 ${page.layoutId === layout.id ? "bg-blue-50 ring-2 ring-blue-600" : "hover:bg-neutral-100"}`}
            >
              <PageThumb book={book} page={sample} width={book.size.width > book.size.height ? 76 : 60} />
              <span className="line-clamp-1 text-[11px] text-neutral-600">{layout.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="배경">
        <Row label="배경색">
          <ColorField
            value={page.background?.color}
            fallback={book.theme.background}
            onChange={(c) => update((bk) => updatePage(bk, page.id, (p) => ({ ...p, background: { ...p.background, color: c } })), `bg:${page.id}`)}
            onReset={() => update((bk) => updatePage(bk, page.id, (p) => ({ ...p, background: { ...p.background, color: undefined } })))}
          />
        </Row>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={() => onPickImage("background")}>배경 이미지</button>
          {page.background?.imageUrl && (
            <button type="button" className="btn-danger" onClick={() => update((bk) => updatePage(bk, page.id, (p) => ({ ...p, background: { ...p.background, imageUrl: undefined } })))}>
              빼기
            </button>
          )}
        </div>
      </Section>
    </>
  );
}

// ── 책 ───────────────────────────────────────────────

function fontKeyOf(css: string): FontKey | "" {
  return (Object.keys(FONTS) as FontKey[]).find((k) => FONTS[k].css === css) ?? "";
}

function BookPanel({ book, update }: { book: Book; update: Update }) {
  const setTheme = (patch: Partial<Book["theme"]>, key?: string) => update((bk) => ({ ...bk, theme: { ...bk.theme, ...patch } }), key);
  return (
    <>
      <Section title="책 정보">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-600">제목 (목록·공유에 쓰여요)</span>
          <input className={small} maxLength={100} value={book.title} onChange={(e) => update((bk) => ({ ...bk, title: e.target.value }), "book:title")} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-600">부제</span>
          <input className={small} maxLength={150} value={book.subtitle ?? ""} onChange={(e) => update((bk) => ({ ...bk, subtitle: e.target.value || undefined }), "book:subtitle")} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-600">지은이</span>
          <input className={small} maxLength={60} value={book.author ?? ""} onChange={(e) => update((bk) => ({ ...bk, author: e.target.value || undefined }), "book:author")} />
        </label>
        <p className="text-xs text-neutral-400">표지에 보이는 글자는 표지 페이지의 블록을 직접 고쳐 주세요.</p>
      </Section>

      <Section title="크기">
        <select
          className={small}
          value={book.size.preset}
          onChange={(e) => {
            const preset = e.target.value as SizePreset;
            if (confirm("책 크기를 바꾸면 모든 블록 위치가 비율대로 바뀝니다. 계속할까요?")) update((bk) => resizeBook(bk, preset));
          }}
        >
          {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((s) => (
            <option key={s} value={s}>{SIZE_LABEL[s]} ({SIZE_PRESETS[s].width}×{SIZE_PRESETS[s].height})</option>
          ))}
        </select>
      </Section>

      <Section title="테마">
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => setTheme(p.theme)}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 ${book.theme.templateId === p.id ? "bg-blue-50 ring-2 ring-blue-600" : "hover:bg-neutral-100"}`}
            >
              <span className="flex h-8 w-full overflow-hidden rounded ring-1 ring-black/10">
                <span className="flex-[3]" style={{ background: p.theme.primary }} />
                <span className="flex-1" style={{ background: p.theme.secondary }} />
                <span className="flex-1" style={{ background: p.theme.background }} />
              </span>
              <span className="line-clamp-1 text-[11px] text-neutral-600">{p.name}</span>
            </button>
          ))}
        </div>
        <Row label="주 색"><ColorField value={book.theme.primary} fallback="#000000" onChange={(c) => setTheme({ primary: c, templateId: "custom" }, "theme:primary")} /></Row>
        <Row label="보조 색"><ColorField value={book.theme.secondary} fallback="#000000" onChange={(c) => setTheme({ secondary: c, templateId: "custom" }, "theme:secondary")} /></Row>
        <Row label="종이 색"><ColorField value={book.theme.background} fallback="#ffffff" onChange={(c) => setTheme({ background: c, templateId: "custom" }, "theme:background")} /></Row>
        <Row label="글자 색"><ColorField value={book.theme.text} fallback="#000000" onChange={(c) => setTheme({ text: c, templateId: "custom" }, "theme:text")} /></Row>
        <Row label="제목 글꼴">
          <select className={`${small} w-44`} value={fontKeyOf(book.theme.headingFont)} onChange={(e) => e.target.value && setTheme({ headingFont: FONTS[e.target.value as FontKey].css })}>
            {fontKeyOf(book.theme.headingFont) === "" && <option value="">사용자 지정</option>}
            {(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
          </select>
        </Row>
        <Row label="본문 글꼴">
          <select className={`${small} w-44`} value={fontKeyOf(book.theme.bodyFont)} onChange={(e) => e.target.value && setTheme({ bodyFont: FONTS[e.target.value as FontKey].css })}>
            {fontKeyOf(book.theme.bodyFont) === "" && <option value="">사용자 지정</option>}
            {(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
          </select>
        </Row>
      </Section>
    </>
  );
}
