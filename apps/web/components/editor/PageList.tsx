"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createPage, LAYOUT_LIST } from "@ebook/layouts";
import type { Book, LayoutId } from "@ebook/schema";
import { PageThumb } from "@/components/PageThumb";
import { confirmDialog } from "@/lib/dialog";

// 왼쪽 페이지 목록: 썸네일 클릭으로 이동, 끌어서 순서 바꾸기, 복제·삭제, 레이아웃을 골라 새 페이지 추가

export function PageList({
  book,
  current,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  book: Book;
  current: number;
  onSelect: (i: number) => void;
  onAdd: (afterIndex: number, layoutId: LayoutId) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const landscape = book.size.width > book.size.height;
  const thumbW = landscape ? 150 : 112;

  return (
    <aside className="relative flex w-48 shrink-0 flex-col border-r border-black/[0.06] bg-white">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1 text-sm">
        <span className="font-semibold">페이지</span>
        <span className="chip tabular-nums">{book.pages.length}</span>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-3">
        {book.pages.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dropAt !== null) onMove(dragFrom, dropAt > dragFrom ? dropAt - 1 : dropAt);
              setDragFrom(null);
              setDropAt(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDropAt(null);
            }}
            className="group relative w-full"
          >
            {dropAt === i && <div className="absolute -top-1 right-2 left-2 h-0.5 rounded bg-brand-600" />}
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={`flex w-full flex-col items-center gap-1 rounded-xl p-2 transition ${current === i ? "bg-brand-50" : "hover:bg-neutral-50"} ${dragFrom === i ? "opacity-40" : ""}`}
            >
              <PageThumb book={book} page={p} index={i} width={thumbW} className={`rounded-[3px] ${current === i ? "ring-2 ring-brand-500 ring-offset-2" : ""}`} />
              <span className={`text-xs tabular-nums ${current === i ? "font-semibold text-brand-700" : "text-neutral-400"}`}>{i + 1}</span>
            </button>
            <div className="absolute top-2 right-2 hidden flex-col gap-1 group-hover:flex">
              <IconButton label="위로" disabled={i === 0} onClick={() => onMove(i, i - 1)}>↑</IconButton>
              <IconButton label="아래로" disabled={i === book.pages.length - 1} onClick={() => onMove(i, i + 1)}>↓</IconButton>
              <IconButton label="복제" onClick={() => onDuplicate(i)}>⧉</IconButton>
              <IconButton label="삭제" disabled={book.pages.length <= 1} onClick={async () => (await confirmDialog("되돌리기(Ctrl+Z)로 다시 살릴 수 있어요.", { title: `${i + 1}쪽을 삭제할까요?`, confirmText: "삭제", danger: true })) && onDelete(i)}>✕</IconButton>
            </div>
            {dropAt === i + 1 && i === book.pages.length - 1 && <div className="absolute right-2 -bottom-1 left-2 h-0.5 rounded bg-brand-600" />}
          </li>
        ))}
      </ol>
      <div className="border-t border-black/[0.06] p-2">
        <button type="button" className="btn w-full" onClick={() => setPicker((v) => !v)}>
          <Plus className="size-4" /> 페이지 추가
        </button>
      </div>
      {picker && (
        <LayoutPicker
          book={book}
          onPick={(id) => {
            setPicker(false);
            onAdd(current, id);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </aside>
  );
}

function IconButton({ label, children, disabled, onClick }: { label: string; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-6 place-items-center rounded-md bg-white/95 text-xs text-neutral-600 shadow-sm ring-1 ring-black/10 hover:bg-white hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function LayoutPicker({ book, onPick, onClose }: { book: Book; onPick: (id: LayoutId) => void; onClose: () => void }) {
  const samples = useMemo(() => LAYOUT_LIST.map((l) => ({ layout: l, page: createPage(l.id, book.size) })), [book.size]);
  return (
    <div className="absolute bottom-14 left-2 z-30 w-[22rem] rounded-2xl border border-black/[0.06] bg-white p-3 shadow-lift">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">어떤 페이지를 넣을까요?</span>
        <button type="button" className="text-neutral-500 hover:text-neutral-900" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {samples.map(({ layout, page }) => (
          <button key={layout.id} type="button" onClick={() => onPick(layout.id)} className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-neutral-100">
            <PageThumb book={book} page={page} width={book.size.width > book.size.height ? 70 : 58} />
            <span className="line-clamp-1 text-[11px] text-neutral-600">{layout.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">지금 보고 있는 페이지 뒤에 들어가요.</p>
    </div>
  );
}
