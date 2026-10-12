"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { refreshToc } from "@ebook/layouts";
import type { Book } from "@ebook/schema";
import { api, ApiError } from "@/lib/api";

// 에디터 상태: Book 하나 + undo/redo 기록 + 자동 저장.
// 글자 입력·드래그처럼 짧은 시간에 연달아 바뀌는 수정은 mergeKey로 한 단계로 묶는다.
// 기록은 ref에 두고(상태 updater 안에서 부수 효과를 내지 않도록) 바뀔 때만 다시 그린다.

const HISTORY_LIMIT = 100;
const MERGE_MS = 800;
const SAVE_DELAY_MS = 1200;

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

/** 저장 직전 정리: 목차 갱신, 빈 제목 방지 (스키마상 제목은 필수) */
const normalize = (b: Book) => refreshToc(b.title.trim() ? b : { ...b, title: "제목 없음" });
const docOf = (b: Book) => JSON.stringify(normalize(b));

export function useBookState(initial: Book, initialVersion: number) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const book = useRef(initial);
  const past = useRef<Book[]>([]);
  const future = useRef<Book[]>([]);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);

  const [saveState, setSaveStateRaw] = useState<SaveState>("saved");
  const saveStateRef = useRef<SaveState>("saved");
  const setSaveState = (s: SaveState) => {
    saveStateRef.current = s;
    setSaveStateRaw(s);
  };
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const version = useRef(initialVersion);
  const savedDoc = useRef(docOf(initial));
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 바로 저장. 저장에 실패하면 false */
  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    if (saveStateRef.current === "conflict") return false;
    const doc = normalize(book.current);
    const json = JSON.stringify(doc);
    if (json === savedDoc.current) {
      setSaveState("saved");
      return true;
    }
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await api<{ version: number; updatedAt: number }>(`/api/books/${doc.id}`, {
          method: "PATCH",
          body: { doc, version: version.current },
        });
        version.current = res.version;
        savedDoc.current = json;
        setLastSavedAt(res.updatedAt);
        setSaveError("");
        setSaveState(docOf(book.current) === json ? "saved" : "dirty");
      } catch (e) {
        setSaveState(e instanceof ApiError && e.code === "VERSION_CONFLICT" ? "conflict" : "error");
        setSaveError(e instanceof Error ? e.message : "저장하지 못했습니다.");
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (saveStateRef.current === "dirty") schedule();
    const after = saveStateRef.current as SaveState; // await 사이에 바뀌었을 수 있다
    return after !== "error" && after !== "conflict";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback(() => {
    if (saveStateRef.current === "conflict") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [save]);

  const commit = useCallback(
    (next: Book) => {
      book.current = next;
      if (saveStateRef.current !== "conflict" && saveStateRef.current !== "saving") {
        setSaveState(docOf(next) === savedDoc.current ? "saved" : "dirty");
      }
      schedule();
      rerender();
    },
    [schedule],
  );

  /** 책을 바꾼다. 같은 mergeKey로 MERGE_MS 안에 다시 바꾸면 undo 기록을 새로 쌓지 않는다 */
  const update = useCallback(
    (fn: (b: Book) => Book, mergeKey?: string) => {
      const prev = book.current;
      const next = fn(prev);
      if (next === prev) return;
      const now = Date.now();
      const merge = mergeKey && lastMerge.current?.key === mergeKey && now - lastMerge.current.at < MERGE_MS;
      lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null;
      if (!merge) past.current = [...past.current.slice(-HISTORY_LIMIT + 1), prev];
      future.current = [];
      commit(next);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [book.current, ...future.current];
    lastMerge.current = null;
    commit(prev);
  }, [commit]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, book.current];
    lastMerge.current = null;
    commit(next);
  }, [commit]);

  // 저장 안 된 채로 나가려 하면 확인
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (docOf(book.current) !== savedDoc.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return {
    book: book.current,
    update,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    save,
    saveState,
    saveError,
    lastSavedAt,
  };
}
