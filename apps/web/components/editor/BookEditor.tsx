"use client";

import Link from "next/link";
import {
  BookDown,
  CircleDot,
  ListMusic,
  Mail,
  AlertTriangle,
  Code2,
  Crosshair,
  Film,
  GalleryHorizontal,
  Music,
  RectangleHorizontal,
  Tag,
  Circle,
  Cloud,
  CloudOff,
  Eye,
  Heading,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Printer,
  Quote,
  Redo2,
  Share2,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useCallback, useEffect, useState } from "react";
import { moveOverflowToNextPage, overflowingBlocks } from "@ebook/layouts";
import { newId } from "@ebook/layouts";
import type { Block, Book, LayoutId } from "@ebook/schema";
import { installTextMeasurer } from "@/lib/measure";
import { pickFile, pickFiles, pickImageFile, uploadImage, uploadMedia } from "@/lib/upload";
import { Canvas } from "./Canvas";
import { Inspector, type InspectorTab } from "./Inspector";
import {
  addBlock,
  deleteBlock,
  deletePage,
  duplicateBlock,
  duplicatePage,
  insertPage,
  makeBlock,
  movePage,
  NEW_BLOCK_LABELS,
  updateBlock,
  updatePage,
  type NewBlockKind,
} from "./ops";
import { PageList } from "./PageList";
import { PublishDialog, type Publication } from "./PublishDialog";
import { useBookState, type SaveState } from "./useBookState";

// 복사한 블록 (탭 안에서만, 쪽을 옮겨 다니며 붙여 넣을 수 있게)
let clipboard: Block | null = null;

// 에디터 (SPEC 8): 왼쪽 페이지 목록 · 가운데 캔버스 · 오른쪽 속성 패널, 위 도구 막대.
// 단축키: Ctrl+Z / Ctrl+Shift+Z(Ctrl+Y) 되돌리기·다시, Delete 블록 삭제, Ctrl+D 블록 복제,
// 방향키 1px(Shift 10px) 이동, PageUp/PageDown 페이지 이동, Esc 선택 해제, Ctrl+S 바로 저장.

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "저장됨",
  dirty: "저장 대기",
  saving: "저장 중…",
  error: "저장 실패",
  conflict: "충돌",
};

const INSERT_BUTTONS: { kind: NewBlockKind; icon: typeof Type }[] = [
  { kind: "heading", icon: Heading },
  { kind: "paragraph", icon: Type },
  { kind: "list", icon: List },
  { kind: "quote", icon: Quote },
  { kind: "image", icon: ImageIcon },
  { kind: "rect", icon: Square },
  { kind: "ellipse", icon: Circle },
  { kind: "line", icon: Minus },
  { kind: "link", icon: LinkIcon },
];
// 인터랙티브 요소 (FlipHTML5·Flipsnack의 멀티미디어·인터랙션)
const INTERACTIVE_BUTTONS: { kind: NewBlockKind; icon: typeof Type }[] = [
  { kind: "video", icon: Film },
  { kind: "audio", icon: Music },
  { kind: "slideshow", icon: GalleryHorizontal },
  { kind: "button", icon: RectangleHorizontal },
  { kind: "hotspot", icon: Crosshair },
  { kind: "product", icon: Tag },
  { kind: "embed", icon: Code2 },
  { kind: "form", icon: Mail },
  { kind: "icon", icon: CircleDot },
  { kind: "player", icon: ListMusic },
];

const ZOOMS = ["fit", 0.5, 0.75, 1, 1.25, 1.5] as const;

export function BookEditor({
  initialBook,
  initialVersion,
  initialPublication,
  initialUpdatedAt,
}: {
  initialBook: Book;
  initialVersion: number;
  initialPublication: Publication;
  initialUpdatedAt: number;
}) {
  const { book, update, undo, redo, canUndo, canRedo, save, saveState, saveError, lastSavedAt } = useBookState(initialBook, initialVersion);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("page");
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>("fit");
  const [publication, setPublication] = useState<Publication>(initialPublication);
  const [publishOpen, setPublishOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const index = Math.min(pageIndex, book.pages.length - 1);
  const page = book.pages[index];
  const block = page.blocks.find((b) => b.id === selectedId) ?? null;
  const overflow = overflowingBlocks(page, book.size).length > 0;

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setTab("block");
    else setEditingId(null);
  }, []);

  const goPage = (i: number) => {
    setPageIndex(Math.max(0, Math.min(book.pages.length - 1, i)));
    select(null);
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  async function pickImage(target: { blockId: string } | "background", pageId = page.id) {
    const file = await pickImageFile();
    if (!file) return;
    try {
      flash("이미지를 올리는 중…");
      const url = await uploadImage(file);
      if (target === "background") update((bk) => updatePage(bk, pageId, (p) => ({ ...p, background: { ...p.background, imageUrl: url } })));
      else update((bk) => updateBlock(bk, pageId, target.blockId, (b) => (b.type === "image" ? { ...b, data: { ...b.data, src: url, alt: b.data.alt || file.name.replace(/\.[^.]+$/, "") } } : b)));
      setNotice("");
    } catch (e) {
      flash(e instanceof Error ? e.message : "이미지를 올리지 못했습니다.");
    }
  }

  function add(kind: NewBlockKind) {
    const b = makeBlock(kind, book);
    update((bk) => addBlock(bk, page.id, b));
    select(b.id);
    if (kind === "image") void pickImage({ blockId: b.id });
    if (kind === "audio") void pickMedia(b.id, "audio/*");
    if (kind === "slideshow") void addSlides(b.id);
  }

  async function pickMedia(blockId: string, accept: string, pageId = page.id) {
    const file = await pickFile(accept);
    if (!file) return;
    try {
      flash(`${file.type.startsWith("video") ? "동영상" : "오디오"}을 올리는 중…`);
      const url = await uploadMedia(file);
      update((bk) =>
        updateBlock(bk, pageId, blockId, (b) =>
          b.type === "audio" ? { ...b, data: { ...b.data, src: url, title: b.data.title && b.data.title !== "오디오 재생" ? b.data.title : file.name.replace(/\.[^.]+$/, "") } } : b.type === "video" ? { ...b, data: { ...b.data, src: url } } : b,
        ),
      );
      setNotice("");
    } catch (e) {
      flash(e instanceof Error ? e.message : "올리지 못했습니다.");
    }
  }

  async function addSlides(blockId: string, pageId = page.id) {
    const files = await pickFiles("image/png,image/jpeg,image/gif,image/webp");
    if (!files.length) return;
    try {
      const urls: string[] = [];
      for (const [i, f] of files.slice(0, 30).entries()) {
        flash(`사진 올리는 중… (${i + 1}/${Math.min(files.length, 30)})`);
        urls.push(await uploadImage(f));
      }
      update((bk) => updateBlock(bk, pageId, blockId, (b) => (b.type === "slideshow" ? { ...b, data: { ...b.data, images: [...b.data.images, ...urls.map((src) => ({ src }))].slice(0, 30) } } : b)));
      setNotice("");
    } catch (e) {
      flash(e instanceof Error ? e.message : "올리지 못했습니다.");
    }
  }

  /** 이미지·오디오를 골라 올리고 주소만 돌려준다 (상품 사진, 팝업 그림, 뷰어 로고·배경음 등) */
  async function pickUrl(kind: "image" | "audio" | "media"): Promise<string | null> {
    const file = kind === "image" ? await pickImageFile() : await pickFile(kind === "audio" ? "audio/*" : "audio/*,video/mp4,video/webm");
    if (!file) return null;
    try {
      flash(kind === "image" ? "이미지를 올리는 중…" : "오디오를 올리는 중…");
      const url = kind === "image" ? await uploadImage(file) : await uploadMedia(file);
      setNotice("");
      return url;
    } catch (e) {
      flash(e instanceof Error ? e.message : "올리지 못했습니다.");
      return null;
    }
  }

  // 레이아웃을 바꿀 때 글 높이를 실제 글꼴로 재도록
  useEffect(() => {
    void installTextMeasurer();
  }, []);

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        let id: string | null = null;
        update((bk) => {
          const r = duplicateBlock(bk, page.id, selectedId);
          id = r.id;
          return r.book;
        });
        if (id) select(id);
      } else if (mod && e.key.toLowerCase() === "c" && block) {
        clipboard = structuredClone(block);
        flash("블록을 복사했어요. 다른 쪽에서 Ctrl+V로 붙여 넣으세요.");
      } else if (mod && e.key.toLowerCase() === "v" && clipboard) {
        e.preventDefault();
        const copy = { ...structuredClone(clipboard), id: newId(), slot: undefined, locked: false } as typeof clipboard;
        if (clipboard && page.blocks.some((b) => b.x === copy.x && b.y === copy.y)) {
          copy.x += 20;
          copy.y += 20;
        }
        update((bk) => addBlock(bk, page.id, copy));
        select(copy.id);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !block?.locked) {
        e.preventDefault();
        update((bk) => deleteBlock(bk, page.id, selectedId));
        select(null);
      } else if (e.key === "Escape") {
        select(null);
      } else if (e.key === "Enter" && selectedId && block && ["heading", "paragraph", "list", "quote", "link"].includes(block.type)) {
        e.preventDefault();
        setEditingId(selectedId);
      } else if (e.key.startsWith("Arrow") && selectedId) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key] ?? [0, 0];
        update((bk) => updateBlock(bk, page.id, selectedId, (b) => ({ ...b, x: b.x + dx, y: b.y + dy })), `nudge:${selectedId}`);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        goPage(index + 1);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        goPage(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** 미리보기·인쇄·퍼블리시는 서버에 저장된 내용을 쓰므로 먼저 저장한다 */
  async function openAfterSave(path: string) {
    const w = window.open("about:blank", "_blank");
    if (!(await save())) {
      w?.close();
      flash("저장하지 못해 열 수 없어요. 저장 상태를 확인해 주세요.");
      return;
    }
    if (w) w.location.href = path;
    else window.open(path, "_blank");
  }

  const savedAt = lastSavedAt ?? initialUpdatedAt;
  const hasUnpublishedChanges = !!publication && (saveState !== "saved" || savedAt > publication.publishedAt);

  return (
    <div className="flex h-dvh flex-col bg-neutral-100">
      {/* 도구 막대 */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-black/[0.06] bg-white px-2.5">
        <Link href="/" className="icon-btn" title="내 책으로" aria-label="내 책으로">
          <LogoMark size={26} />
        </Link>
        <div className="flex min-w-0 max-w-[16rem] flex-col leading-tight">
          <span className="truncate text-[15px] font-semibold">{book.title || "제목 없음"}</span>
          <span
            className={`flex items-center gap-1 text-xs ${saveState === "error" || saveState === "conflict" ? "text-red-600" : "text-neutral-400"}`}
            title={saveError || undefined}
          >
            {saveState === "saving" ? <Loader2 className="size-3 animate-spin" /> : saveState === "saved" ? <Cloud className="size-3" /> : saveState === "dirty" ? <Cloud className="size-3 opacity-50" /> : <CloudOff className="size-3" />}
            {SAVE_LABEL[saveState]}
          </span>
        </div>

        <div className="mx-1.5 h-6 w-px bg-black/[0.08]" />
        <button type="button" className="icon-btn" disabled={!canUndo} onClick={undo} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기"><Undo2 className="size-[18px]" /></button>
        <button type="button" className="icon-btn" disabled={!canRedo} onClick={redo} title="다시 하기 (Ctrl+Shift+Z)" aria-label="다시 하기"><Redo2 className="size-[18px]" /></button>
        <div className="mx-1.5 h-6 w-px bg-black/[0.08]" />

        {/* 블록 넣기 */}
        {[INSERT_BUTTONS, INTERACTIVE_BUTTONS].map((group, gi) => (
          <div key={gi} className={`hidden items-center gap-0.5 rounded-xl p-0.5 md:flex ${gi ? "ml-1 bg-brand-50" : "bg-neutral-100/80"}`} role="toolbar" aria-label={gi ? "인터랙티브 요소 넣기" : "블록 넣기"}>
            {group.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                className={`group relative grid size-8 place-items-center rounded-[9px] transition hover:bg-white hover:text-ink hover:shadow-[0_1px_2px_rgb(0_0_0/0.08)] ${gi ? "text-brand-700" : "text-neutral-600"}`}
                onClick={() => add(kind)}
                aria-label={`${NEW_BLOCK_LABELS[kind]} 넣기`}
              >
                <Icon className="size-[17px]" />
                <span className="pointer-events-none absolute top-full z-30 mt-2 hidden rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white group-hover:block">{NEW_BLOCK_LABELS[kind]}</span>
              </button>
            ))}
          </div>
        ))}

        <select
          className="ml-1.5 rounded-[9px] border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-black/5"
          value={String(zoom)}
          onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : (Number(e.target.value) as (typeof ZOOMS)[number]))}
          aria-label="확대"
        >
          {ZOOMS.map((z) => <option key={z} value={z}>{z === "fit" ? "화면 맞춤" : `${z * 100}%`}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          {notice && <span className="hidden max-w-60 truncate text-sm text-neutral-500 lg:inline">{notice}</span>}
          <button type="button" className="btn-ghost" onClick={() => openAfterSave(`/books/${book.id}/preview`)} title="플립북으로 미리보기">
            <Eye className="size-4" /> <span className="hidden sm:inline">미리보기</span>
          </button>
          <button type="button" className="btn-ghost" onClick={() => openAfterSave(`/books/${book.id}/print`)} title="PDF로 저장·인쇄">
            <Printer className="size-4" /> <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            title="EPUB(전자책 파일)로 내려받기 — 고정 레이아웃"
            onClick={async () => {
              try {
                const { downloadEpub } = await import("@/lib/export/epub");
                await downloadEpub(book, (d, t) => setNotice(`EPUB 만드는 중… (${d}/${t}쪽)`));
                flash("EPUB 파일을 내려받았어요.");
              } catch (e) {
                flash(e instanceof Error ? e.message : "EPUB을 만들지 못했어요.");
              }
            }}
          >
            <BookDown className="size-4" /> <span className="hidden sm:inline">EPUB</span>
          </button>
          <button type="button" className="btn-primary ml-1 py-2 text-sm" onClick={() => setPublishOpen(true)}>
            <Share2 className="size-4" /> {publication ? "공유" : "퍼블리시"}
          </button>
        </div>
      </header>

      {saveState === "conflict" && (
        <div className="banner-error flex items-center justify-between rounded-none border-x-0">
          <span>{saveError}</span>
          <button type="button" className="btn" onClick={() => window.location.reload()}>새로고침</button>
        </div>
      )}
      {saveState === "error" && (
        <div className="banner-warn flex items-center justify-between rounded-none border-x-0">
          <span>저장하지 못했습니다: {saveError}</span>
          <button type="button" className="btn" onClick={() => void save()}>다시 저장</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <PageList
          book={book}
          current={index}
          onSelect={goPage}
          onAdd={(after, layoutId: LayoutId) => {
            update((bk) => insertPage(bk, after, layoutId).book);
            goPage(after + 1);
          }}
          onDuplicate={(i) => {
            update((bk) => duplicatePage(bk, i).book);
            goPage(i + 1);
          }}
          onDelete={(i) => {
            update((bk) => deletePage(bk, i));
            goPage(Math.min(i, book.pages.length - 2));
          }}
          onMove={(from, to) => {
            update((bk) => movePage(bk, from, to));
            if (from === index) setPageIndex(to);
          }}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas
            book={book}
            page={page}
            index={index}
            selectedId={selectedId}
            editingId={editingId}
            onSelect={select}
            onEdit={setEditingId}
            onRequestImage={(blockId) => void pickImage({ blockId })}
            update={update}
            zoom={zoom}
          />
          {overflow && (
            <div className="flex shrink-0 items-center justify-center gap-3 border-t border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="size-4" />
              <span>본문이 페이지 아래로 넘쳤어요.</span>
              <button
                type="button"
                className="btn py-1"
                onClick={() => {
                  update((bk) => moveOverflowToNextPage(bk, page.id, { body: bk.theme.bodyFont, heading: bk.theme.headingFont }));
                  select(null);
                }}
              >
                넘친 글 다음 쪽으로 보내기
              </button>
            </div>
          )}
          <div className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-black/[0.06] bg-white text-sm text-neutral-600">
            <button type="button" className="icon-btn size-8" disabled={index === 0} onClick={() => goPage(index - 1)} aria-label="이전 페이지"><ChevronLeft className="size-4" /></button>
            <span className="min-w-14 text-center font-medium tabular-nums">{index + 1} <span className="text-neutral-400">/ {book.pages.length}</span></span>
            <button type="button" className="icon-btn size-8" disabled={index >= book.pages.length - 1} onClick={() => goPage(index + 1)} aria-label="다음 페이지"><ChevronRight className="size-4" /></button>
            <span className="ml-4 hidden text-xs text-neutral-400 xl:inline">더블클릭 글 고치기 · 드래그 이동 · Alt 맞춤 끄기 · Delete 삭제</span>
          </div>
        </main>

        <Inspector book={book} page={page} block={block} tab={tab} setTab={setTab} update={update} onSelect={select} onPickImage={(t) => void pickImage(t)}
          onPickMedia={(id, accept) => void pickMedia(id, accept)}
          onAddSlides={(id) => void addSlides(id)}
          pickImageUrl={() => pickUrl("image")}
          pickAudioUrl={() => pickUrl("audio")}
          pickMediaUrl={() => pickUrl("media")}
        />
      </div>

      {publishOpen && (
        <PublishDialog
          bookId={book.id}
          publication={publication}
          setPublication={setPublication}
          hasUnpublishedChanges={hasUnpublishedChanges}
          beforePublish={save}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </div>
  );
}
