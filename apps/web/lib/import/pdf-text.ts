// PDF 쪽의 글자를 "고칠 수 있는 글 블록"으로 바꾸기.
//  1) 같은 쪽을 두 번 그린다 — 원본 그대로 / 글자만 빼고(fillText·strokeText를 막아서). 뒤쪽이 새 배경이 된다.
//  2) pdf.js가 주는 글자 조각(위치·크기·글꼴)을 줄로, 줄을 문단으로 묶는다.
//  3) 두 그림의 차이(글자가 있던 픽셀)에서 글자색을, 웹 글꼴로 잰 폭과 원래 폭의 차이에서 자간을 구한다.
// 스캔한 PDF(글자가 그림인 것)는 글자 정보가 없어서 그대로 이미지로 남는다.

import type { PDFPageProxy, PageViewport } from "pdfjs-dist/legacy/build/pdf.mjs";

/** 쪽 크기에 대한 비율(0~1)로 적은 글 상자. size는 쪽 너비에 대한 글자 크기 비율 */
export type PdfTextBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  size: number;
  lineHeight: number;
  letterSpacing: number; // em
  color: string;
  bold: boolean;
  serif: boolean;
  align: "left" | "center" | "justify";
};

// 낱말 첫머리에 거의 오지 않는 글자(조사·어미) / 글자 단위 줄바꿈일 때 더 붙여 볼 글자
const TAIL = /[다요죠니습됩겠었았였했됐냐며면로를을은는의에께와과랑든록려란까]/;
const TAIL_TIGHT = /[지고서가기게해워져쳐워어아]/;

const SANS = "'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif";
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', serif";
export const pdfTextFont = (serif: boolean) => (serif ? SERIF : SANS);

type Piece = { str: string; x: number; x1: number; base: number; size: number; font: string; doubled?: boolean };
type Line = { text: string; x: number; x1: number; base: number; size: number; font: string; bold: boolean; serif: boolean; color: string; rgb: [number, number, number]; ink: number };

/** 글자만 빼고 그리는 2D 컨텍스트 — pdf.js는 웹 글꼴로 그릴 때 fillText/strokeText를 쓴다 */
export function hideText(ctx: CanvasRenderingContext2D) {
  ctx.fillText = () => {};
  ctx.strokeText = () => {};
}

type Util = { transform: (a: number[], b: number[]) => number[] };

export async function extractTextBoxes(
  page: PDFPageProxy,
  viewport: PageViewport,
  util: Util,
  full: CanvasRenderingContext2D,
  bare: CanvasRenderingContext2D,
): Promise<PdfTextBox[]> {
  const content = await page.getTextContent();
  const pieces: Piece[] = [];
  for (const it of content.items) {
    if (!("str" in it) || !it.str.trim()) continue;
    const tx = util.transform(viewport.transform, it.transform);
    if (Math.abs(tx[1]) > 0.01 * Math.abs(tx[0]) + 0.01) continue; // 돌아간 글자는 건너뛴다
    const size = Math.hypot(tx[2], tx[3]);
    if (size < 2) continue;
    const w = it.width * viewport.scale;
    const piece = { str: it.str, x: tx[4], x1: tx[4] + w, base: tx[5], size, font: it.fontName };
    // 같은 글자를 거의 같은 자리에 한 번 더 그린 것(가짜 굵게: 채우기+외곽선, 살짝 비껴 두 번)은 하나로 합치고 굵게로 본다
    const twin = pieces.find((q) => q.str === piece.str && Math.abs(q.x - piece.x) < size * 0.2 && Math.abs(q.base - piece.base) < size * 0.2);
    if (twin) twin.doubled = true;
    else pieces.push(piece);
  }
  if (!pieces.length) return [];

  // ── 조각 → 줄 ──
  pieces.sort((a, b) => a.base - b.base || a.x - b.x);
  const rawLines: Piece[][] = [];
  for (const p of pieces) {
    const line = rawLines.find((l) => {
      const last = l[l.length - 1];
      return Math.abs(last.base - p.base) < Math.max(last.size, p.size) * 0.4 && p.x >= last.x1 - last.size * 0.5 && p.x - last.x1 < Math.max(last.size, p.size) * 2.5;
    });
    if (line) line.push(p);
    else rawLines.push([p]);
  }

  const fontInfo = (name: string) => {
    let font: { name?: string; bold?: boolean; black?: boolean } | null = null;
    try {
      font = page.commonObjs.has(name) ? page.commonObjs.get(name) : null;
    } catch {
      font = null;
    }
    const style = content.styles[name] as { fontFamily?: string } | undefined;
    const n = font?.name ?? "";
    return {
      bold: !!(font?.bold || font?.black) || /bold|black|heavy|semibold|demibold|extrabold|[-_]?(B|EB|SB|Bd)$/i.test(n),
      serif: /myeongjo|batang|serif|times|mincho|song|garamond|georgia/i.test(n) || (!n && style?.fontFamily === "serif"),
    };
  };

  const lines: Line[] = rawLines.map((ps) => {
    ps.sort((a, b) => a.x - b.x);
    let text = "";
    let prev: Piece | null = null;
    for (const p of ps) {
      if (prev && p.x - prev.x1 > p.size * 0.18 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += " ";
      text += p.str;
      prev = p;
    }
    // 가장 긴 조각의 글꼴·크기를 줄 대표로
    const main = ps.reduce((a, b) => (b.str.length > a.str.length ? b : a));
    const size = main.size;
    const x = ps[0].x;
    const x1 = Math.max(...ps.map((p) => p.x1));
    const base = ps.reduce((s, p) => s + p.base, 0) / ps.length;
    const { rgb, ink } = textInk(full, bare, x, base - size * 0.85, x1, base + size * 0.2);
    const clean = text.replace(/\s+/g, " ").trim();
    // 글자 하나당 잉크 양(크기로 나눔) — 굵게(획을 덧그린 가짜 굵게 포함)를 알아보는 데 쓴다
    const density = ink / Math.max(1, clean.replace(/\s/g, "").length * size * size);
    const info = fontInfo(main.font);
    if (ps.some((p) => p.doubled)) info.bold = true;
    return { text: clean, x, x1, base, size, font: main.font, ...info, rgb, color: hex(rgb), ink: density };
  });
  // 같은 자리에 겹쳐 그린 줄(가짜 굵게를 다른 조각으로 한 번 더 그린 것)은 긴 쪽 하나만 남기고 굵게로 본다
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (!a.text || !b.text || Math.abs(a.base - b.base) > Math.min(a.size, b.size) * 0.25) continue;
      const overlap = Math.min(a.x1, b.x1) - Math.max(a.x, b.x);
      if (overlap < Math.min(a.x1 - a.x, b.x1 - b.x) * 0.8) continue;
      const keep = a.text.length >= b.text.length ? a : b;
      const drop = keep === a ? b : a;
      keep.bold = true;
      drop.text = "";
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) if (!lines[i].text) lines.splice(i, 1);

  // 글자를 지웠는데도 배경에 획이 남은 줄 — 외곽선으로 바꾼 글자(벡터)이거나, 스캔 그림 위에 숨긴 글자층(OCR)이다.
  // 둘레가 한 가지 색이면 그 색으로 덮어 지우고, 그림 위라면 그 줄은 고치지 않고 그림으로 둔다(겹쳐 보이지 않게).
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    const fix = residual(full, bare, l.x - 2, l.base - l.size * 1.05, l.x1 + 2, l.base + l.size * 0.35);
    if (fix === "ok") continue;
    if (fix === "keep") lines.splice(i, 1);
    else if (colorDist(l.rgb, [0, 0, 0]) === 0 || fix.color) {
      l.rgb = fix.color ?? l.rgb;
      l.color = hex(l.rgb);
    }
  }

  // 글꼴 이름에 Bold가 없어도 같은 쪽 보통 줄보다 잉크가 확연히 많으면 굵게로 본다
  const densities = lines.filter((l) => l.text.length >= 4).map((l) => l.ink).sort((a, b) => a - b);
  if (densities.length >= 3) {
    const median = densities[Math.floor(densities.length / 2)];
    for (const l of lines) if (!l.bold && median > 0 && l.ink > median * 1.3) l.bold = true;
  }

  // ── 줄 → 문단 ──
  type Para = { lines: Line[]; gap: number | null; closed: boolean };
  const paras: Para[] = [];
  lines.sort((a, b) => a.base - b.base || a.x - b.x);
  for (const l of lines) {
    const fit = paras.find((p) => {
      if (p.closed) return false;
      const last = p.lines[p.lines.length - 1];
      const d = l.base - last.base;
      if (d <= last.size * 0.5) return false;
      if (Math.abs(l.size - last.size) > last.size * 0.08) return false;
      if (l.bold !== last.bold || l.serif !== last.serif) return false;
      if (colorDist(l.rgb, last.rgb) > 60) return false;
      if (d > last.size * 2.3) return false;
      if (p.gap !== null && Math.abs(d - p.gap) > last.size * 0.35) return false;
      const left = Math.min(...p.lines.map((x) => x.x));
      const right = Math.max(...p.lines.map((x) => x.x1));
      if (l.x1 < left || l.x > right) return false; // 가로로 겹치지 않으면 다른 단
      if (Math.abs(l.x - left) > last.size * 3 && Math.abs((l.x + l.x1) / 2 - (left + right) / 2) > last.size) return false;
      // 앞줄이 오른쪽 끝까지 가지 않았으면(문단 마지막 줄) 새 문단
      if (p.lines.length >= 2 && last.x1 < right - last.size * 2) return false;
      return true;
    });
    if (fit) {
      const last = fit.lines[fit.lines.length - 1];
      if (fit.gap === null) fit.gap = l.base - last.base;
      fit.lines.push(l);
    } else {
      // 이 줄 바로 위에 있던 문단들은 더 이어지지 않는다 (사이에 다른 글이 끼면 닫는다)
      for (const p of paras) {
        const last = p.lines[p.lines.length - 1];
        if (!p.closed && l.base - last.base > last.size * 3) p.closed = true;
      }
      paras.push({ lines: [l], gap: null, closed: false });
    }
  }

  const W = viewport.width;
  const H = viewport.height;
  const measure = document.createElement("canvas").getContext("2d")!;
  return paras.map(({ lines: ls, gap }) => {
    const first = ls[0];
    const size = ls.reduce((s, l) => s + l.size, 0) / ls.length;
    const lh = gap ?? size * 1.5;
    const left = Math.min(...ls.map((l) => l.x));
    const right = Math.max(...ls.map((l) => l.x1));
    const centered = ls.length >= 2 && ls.every((l) => Math.abs((l.x + l.x1) / 2 - (left + right) / 2) < size * 0.6) && ls.some((l) => Math.abs(l.x - left) > size);
    const justified = !centered && ls.length >= 3 && ls.slice(0, -1).every((l) => l.x1 > right - size * 0.6);
    // 줄 잇기: 글자 단위로 줄을 바꾼 글(한글 워드프로세서 기본값)은 낱말 중간에서 줄이 바뀌므로 띄우지 않는다.
    // 그런 글은 마지막 줄을 빼고 모든 줄이 오른쪽 끝에 거의 닿는다. 낱말 단위로 바꾼 글은 줄 끝이 들쭉날쭉하다.
    const body = ls.slice(0, -1);
    // (두 줄짜리 문단은 기준이 될 줄이 하나뿐이라 알 수 없으므로 띄운다)
    const tight = body.length >= 2 && body.every((l) => right - l.x1 < size * 0.9);
    const hangul = /[\u3131-\u318e\uac00-\ud7a3]/;
    const text = ls.reduce((t, l) => {
      if (!t) return l.text;
      if (/-$/.test(t) && /[A-Za-z]-$/.test(t)) return t.slice(0, -1) + l.text;
      // PDF에는 줄 끝 띄어쓰기가 남지 않으므로 다음 줄 첫 글자로 짐작한다: 조사·어미처럼 낱말 첫머리에 잘 안 오는
      // 글자면 앞 낱말에 붙인다. 글자 단위 줄바꿈 문단은 낱말 중간 끊김이 흔해 몇 글자를 더 붙인다.
      if (/^[.,?!)\]}"'”’…·:;%]/.test(l.text)) return t + l.text;
      if (hangul.test(t.at(-1)!) && (TAIL.test(l.text[0]) || (tight && TAIL_TIGHT.test(l.text[0])))) return t + l.text;
      return `${t} ${l.text}`;
    }, "");

    // 자간: 웹 글꼴로 잰 폭이 원래 줄 폭과 같아지도록 (넘침 방지로 작은 쪽 값을 쓴다)
    measure.font = `${first.bold ? 700 : 400} ${size}px ${pdfTextFont(first.serif)}`;
    const sample = ls.length > 1 ? ls.slice(0, -1) : ls;
    const spacings = sample
      .filter((l) => l.text.length >= 4)
      .map((l) => (l.x1 - l.x - measure.measureText(l.text).width) / (l.text.length * size))
      .sort((a, b) => a - b);
    const ls_em = spacings.length ? spacings[Math.floor(spacings.length * 0.25)] : 0;
    const letterSpacing = Math.max(-0.12, Math.min(0.2, ls_em));

    // CSS 줄 상자 안에서 첫 줄 글자 밑선 위치 ≈ 줄높이/2 + 0.36em(고딕) / 0.43em(명조)
    const top = first.base - lh / 2 - size * (first.serif ? 0.43 : 0.36);
    const slack = justified ? size * 0.15 : size * 0.6;
    return {
      x: left / W,
      y: top / H,
      w: Math.min(W - left, right - left + slack) / W,
      h: (ls.length * lh + lh * 0.25) / H,
      text,
      size: size / W,
      lineHeight: Math.round((lh / size) * 100) / 100,
      letterSpacing: Math.round(letterSpacing * 1000) / 1000,
      color: first.color,
      bold: first.bold,
      serif: first.serif,
      align: centered ? "center" : justified ? "justify" : "left",
    } satisfies PdfTextBox;
  });
}

/** 원본과 글자 뺀 그림의 차이가 큰 픽셀(= 글자 획 가운데)의 평균 색과, 글자 픽셀 수(잉크 양) */
function textInk(full: CanvasRenderingContext2D, bare: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): { rgb: [number, number, number]; ink: number } {
  const cw = full.canvas.width;
  const ch = full.canvas.height;
  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));
  const w = Math.min(cw - x, Math.ceil(x1 - x0));
  const h = Math.min(ch - y, Math.ceil(y1 - y0));
  if (w <= 0 || h <= 0) return { rgb: [0, 0, 0], ink: 0 };
  const a = full.getImageData(x, y, w, h).data;
  const b = bare.getImageData(x, y, w, h).data;
  let max = 0;
  const diff = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2]);
    diff[i] = d;
    if (d > max) max = d;
  }
  if (max < 30) return { rgb: [0, 0, 0], ink: 0 };
  let r = 0, g = 0, bl = 0, n = 0, ink = 0;
  for (let i = 0; i < w * h; i++) {
    ink += diff[i] / max; // 가장자리 반투명 픽셀은 덜 센다
    if (diff[i] < max * 0.7) continue;
    r += a[i * 4];
    g += a[i * 4 + 1];
    bl += a[i * 4 + 2];
    n++;
  }
  return { rgb: [Math.round(r / n), Math.round(g / n), Math.round(bl / n)], ink };
}

/**
 * 글자를 뺀 그림(bare)에 아직 글자 획이 남아 있는지 본다.
 *  ok: 잘 지워짐 / keep: 그림 위라 지울 수 없음 / { color }: 바탕색으로 덮어 지움(글자색도 원본 획에서 다시 구함)
 */
function residual(
  full: CanvasRenderingContext2D,
  bare: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): "ok" | "keep" | { color: [number, number, number] | null } {
  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));
  const w = Math.min(bare.canvas.width - x, Math.ceil(x1 - x0));
  const h = Math.min(bare.canvas.height - y, Math.ceil(y1 - y0));
  if (w < 3 || h < 3) return "ok";
  const b = bare.getImageData(x, y, w, h).data;
  // 바탕색 = 둘레 픽셀의 중앙값
  const border: [number, number, number][] = [];
  for (let i = 0; i < w; i++) for (const j of [0, h - 1]) border.push(px(b, (j * w + i) * 4));
  for (let j = 0; j < h; j++) for (const i of [0, w - 1]) border.push(px(b, (j * w + i) * 4));
  const bg: [number, number, number] = [0, 1, 2].map((k) => border.map((c) => c[k]).sort((p, q) => p - q)[border.length >> 1]) as [number, number, number];
  const uniform = border.filter((c) => colorDist(c, bg) < 30).length >= border.length * 0.9;
  const f = full.getImageData(x, y, w, h).data;
  let inkFull = 0, inkBare = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (colorDist(px(f, i), bg) > 80) inkFull++;
    if (colorDist(px(b, i), bg) > 80) inkBare++;
  }
  if (inkFull === 0 || inkBare < inkFull * 0.3) return "ok";
  if (!uniform) return "keep";
  // 원본 획 색: 바탕에서 가장 먼 픽셀들의 평균
  let far = 0;
  for (let i = 0; i < w * h * 4; i += 4) far = Math.max(far, colorDist(px(f, i), bg));
  let r = 0, g = 0, bl = 0, n = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (colorDist(px(f, i), bg) < far * 0.8) continue;
    r += f[i];
    g += f[i + 1];
    bl += f[i + 2];
    n++;
  }
  bare.fillStyle = hex(bg);
  bare.fillRect(x, y, w, h);
  return { color: n ? [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] : null };
}

const px = (d: Uint8ClampedArray, i: number): [number, number, number] => [d[i], d[i + 1], d[i + 2]];
const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const colorDist = (a: [number, number, number], b: [number, number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
