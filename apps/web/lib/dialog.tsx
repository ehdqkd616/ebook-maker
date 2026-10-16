"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircleHelp, Info, PenLine, TriangleAlert } from "lucide-react";

// 브라우저 기본 confirm/alert/prompt 대신 쓰는 대화상자. Provider 없이 어디서나 부를 수 있도록
// 부를 때마다 작은 React 루트를 만들어 띄우고, 닫히면 지운다.
// 뷰어가 전체 화면이면 body에 붙인 요소는 보이지 않으므로 전체 화면 요소 안에 띄운다.

type Kind = "confirm" | "alert" | "prompt";
type Base = { title?: string; confirmText?: string; cancelText?: string; danger?: boolean };
type PromptOpts = Base & { placeholder?: string; defaultValue?: string };

function open<T>(kind: Kind, message: string, opts: PromptOpts, cancelValue: T, toResult: (input: string) => T): Promise<T> {
  if (typeof document === "undefined") return Promise.resolve(cancelValue);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    (document.fullscreenElement ?? document.body).appendChild(host);
    const root = createRoot(host);
    const prevFocus = document.activeElement as HTMLElement | null;
    const close = (value: T) => {
      resolve(value);
      // 닫히는 애니메이션이 끝난 뒤 지운다
      setTimeout(() => {
        root.unmount();
        host.remove();
        prevFocus?.focus?.();
      }, 160);
    };
    root.render(<Dialog kind={kind} message={message} opts={opts} onConfirm={(input) => close(toResult(input))} onCancel={() => close(cancelValue)} />);
  });
}

/** 확인/취소. 확인이면 true */
export const confirmDialog = (message: string, opts: Base = {}) => open<boolean>("confirm", message, opts, false, () => true);

/** 안내만 하고 확인 버튼 하나 */
export const alertDialog = (message: string, opts: Omit<Base, "cancelText" | "danger"> = {}) => open<void>("alert", message, opts, undefined, () => undefined);

/** 한 줄 입력. 취소하면 null */
export const promptDialog = (message: string, opts: PromptOpts = {}) => open<string | null>("prompt", message, opts, null, (input) => input);

function Dialog({ kind, message, opts, onConfirm, onCancel }: { kind: Kind; message: string; opts: PromptOpts; onConfirm: (input: string) => void; onCancel: () => void }) {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [value, setValue] = useState(opts.defaultValue ?? "");
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    (kind === "prompt" ? inputRef.current : okRef.current)?.focus();
    return () => cancelAnimationFrame(id);
  }, [kind]);

  const finish = (ok: boolean) => {
    if (closing) return;
    setClosing(true);
    if (ok) onConfirm(value);
    else onCancel();
  };

  const visible = shown && !closing;
  const Icon = opts.danger ? TriangleAlert : kind === "prompt" ? PenLine : kind === "alert" ? Info : CircleHelp;

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center p-4 font-sans text-ink"
      style={{ background: "rgb(20 18 31 / 0.45)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0, transition: "opacity .16s ease" }}
      onMouseDown={(e) => e.target === e.currentTarget && kind !== "alert" && finish(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          finish(kind === "alert");
        }
      }}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eb-dialog-title"
        className="w-full max-w-[400px] rounded-2xl border border-black/[0.06] bg-white p-6 shadow-lift"
        style={{ transform: visible ? "none" : "translateY(8px) scale(.97)", transition: "transform .18s cubic-bezier(.2,.8,.2,1)" }}
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <div className="flex gap-4">
          <div className={`grid size-10 shrink-0 place-items-center rounded-full ${opts.danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="eb-dialog-title" className="text-[15px] leading-6 font-semibold">
              {opts.title ?? (kind === "alert" ? "알림" : kind === "prompt" ? "입력" : opts.danger ? "정말 할까요?" : "확인")}
            </h2>
            <p className="mt-1 text-sm leading-6 whitespace-pre-line text-neutral-600">{message}</p>
            {kind === "prompt" && (
              <input ref={inputRef} className="input mt-3" value={value} placeholder={opts.placeholder} onChange={(e) => setValue(e.target.value)} />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {kind !== "alert" && (
            <button type="button" className="btn" onClick={() => finish(false)}>
              {opts.cancelText ?? "취소"}
            </button>
          )}
          <button
            ref={okRef}
            type="submit"
            className={opts.danger ? "inline-flex items-center justify-center rounded-[10px] bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.15)] transition hover:bg-red-700 active:translate-y-px" : "btn-primary py-2 text-sm"}
          >
            {opts.confirmText ?? "확인"}
          </button>
        </div>
      </form>
    </div>
  );
}
