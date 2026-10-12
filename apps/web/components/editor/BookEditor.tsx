"use client";

import Link from "next/link";
import {
  AlertTriangle,
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
import type { Book, LayoutId } from "@ebook/schema";
import { installTextMeasurer } from "@/lib/measure";
import { uploadImage, pickImageFile } from "@/lib/upload";
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
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
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
        <div className="hidden items-center gap-0.5 rounded-xl bg-neutral-100/80 p-0.5 md:flex" role="toolbar" aria-label="블록 넣기">
          {INSERT_BUTTONS.map(({ kind, icon: Icon }) => (
            <button key={kind} type="button" className="group relative grid size-8 place-items-center rounded-[9px] text-neutral-600 transition hover:bg-white hover:text-ink hover:shadow-[0_1px_2px_rgb(0_0_0/0.08)]" onClick={() => add(kind)} aria-label={`${NEW_BLOCK_LABELS[kind]} 넣기`}>
              <Icon className="size-[17px]" />
              <span className="pointer-events-none absolute top-full mt-2 hidden rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white group-hover:block">{NEW_BLOCK_LABELS[kind]}</span>
            </button>
          ))}
        </div>

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

        <Inspector book={book} page={page} block={block} tab={tab} setTab={setTab} update={update} onSelect={select} onPickImage={(t) => void pickImage(t)} />
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
