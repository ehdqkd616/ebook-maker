// FlipHTML5 "HTML로 내려받기" 폴더(또는 zip)를 Ebook Maker 책으로 바꾼다.
// 세광 음악 교과서처럼 FlipHTML5로 만든 플립북을 그대로 옮겨 와 이어서 고칠 수 있게 하는 것이 목적.
//
// 읽는 파일 (모두 코드 실행 없이 데이터로만 읽는다)
//   files/pageEditor.js            쪽 순서·배경 그림·쪽 위 요소(링크·아이콘·음악)   ← 필수
//   files/large/*                  쪽 그림
//   files/pageConfig/*             아이콘·팝업 그림·mp3
//   files/search/search_config.js  쪽 글 (검색용)
//   files/search/bookmark_config.js 목차
//   Sekwang_Popup/maintenance/videoList.js  세광 악보 영상 플레이어 목록 (있으면)
//   index.html                     책 제목
//
// 요소 바꾸기
//   link   → 투명 클릭 영역(핫스팟): 쪽 이동 / 웹 주소 / 전화 / 메일
//   image  → 그림 블록 + 눌렀을 때(팝업 그림·동영상·링크·쪽 이동)
//   pluginMusic → 연습 플레이어 (세광 inner-player는 트랙·절·구간까지, mp3면 한 트랙짜리)

import { newId, sizeForAspect } from "@ebook/layouts";
import type { Block, BlockAction, Book, Page, TocEntry } from "@ebook/schema";
import { parseJsData } from "./jsdata";

export type FlipSource = {
  /** 책 폴더 기준 경로의 글 파일 (없으면 null) */
  text: (path: string) => Promise<string | null>;
  exists: (path: string) => boolean;
  /** 책 폴더 기준 경로의 파일을 올리고 주소를 돌려준다 (없거나 못 올리면 null) */
  upload: (path: string) => Promise<string | null>;
};

export type FlipResult = { title: string; size: Book["size"]; pages: Page[]; toc: TocEntry[] };
export type FlipReport = { pages: number; links: number; icons: number; players: number; skipped: Record<string, number>; missing: number };

type FItem = {
  type: string;
  name?: string;
  fileName?: string;
  style?: Record<string, string | number>;
  actionList?: Record<string, Record<string, unknown>>[];
  musicList?: { fileName?: string; name?: string; url?: string }[];
};
type FPage = { items?: FItem[]; backgroundImage?: string; searchMapIndex?: number };
type FEditor = { pageConfig?: { pageWidth?: number; pageHeight?: number }; pages: FPage[] };
type FOutline = { caption: string; page: number | string; children?: FOutline[] };
type VideoEntry = Record<string, unknown> & { sectionTime?: Record<string, unknown> | unknown[]; sectionName?: string[] };

const base = (u: string) => decodeURIComponent(u.split(/[?#]/)[0].split("/").pop() ?? "");
const px = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0);
const decodeHtml = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

// 세광 악보 플레이어의 트랙 이름과 구간 시각 이름표 (inner-player.html의 버튼 순서)
const TRACKS: [field: string, label: string, timeKey: string][] = [
  ["videoArAccompanimentUrl1", "반주 유형1", "ar"],
  ["videoArUrl", "노래 듣기", "ar"],
  ["videoMrUrl", "반주 듣기", "mr"],
  ["videoArOriginalUrl", "원어 듣기", "original-ar"],
  ["videoArVarUrl", "변형", "var-ar"],
  ["videoMrVarUrl", "변형 반주", "var-mr"],
  ["videoArVarUrl2", "변형2", "var-ar2"],
  ["videoMrVarUrl2", "변형 반주2", "var-mr2"],
  ["videoArFirstUrl", "위 성부", "ar-first"],
  ["videoArSecondUrl", "아래 성부", "ar-second"],
  ["videoArOriFirstUrl", "원어 위", "original-ar-first"],
  ["videoArOriSecondUrl", "원어 아래", "original-ar-second"],
  ["videoArMaleUrl", "남성", "ar-male"],
  ["videoArFemaleUrl", "여성", "ar-female"],
  ["videoArRecorder1", "리코더1", "ar-recorder1"],
  ["videoArRecorder2", "리코더2", "ar-recorder2"],
  ["videoArKalimba", "칼림바", "ar-kalimba"],
  ["videoArPiano", "피아노", "ar-piano"],
  ["videoArAccompanimentUrl2", "반주 유형2", "ar"],
  ["videoArRythmUrl1", "리듬", "ar"],
];

type Verse = { label?: string; sections: { label?: string; time: number }[] };

/** sectionTime 한 갈래 → 절·구간 (숫자 배열이면 한 절, 배열의 배열이면 여러 절) */
function toVerses(times: unknown, names?: string[]): Verse[] {
  if (!Array.isArray(times) || !times.length) return [];
  if (Array.isArray(times[0])) {
    return (times as unknown[][]).map((v, i) => ({ label: `${i + 1}절`, sections: v.filter((t): t is number => typeof t === "number").map((t) => ({ time: t })) }));
  }
  return [{ sections: (times as unknown[]).filter((t): t is number => typeof t === "number").map((t, i) => ({ time: t, label: names?.[i] })) }];
}

function playerFromVideo(entry: VideoEntry, title: string): Extract<Block, { type: "player" }>["data"] | null {
  const st = (entry.sectionTime && !Array.isArray(entry.sectionTime) ? entry.sectionTime : {}) as Record<string, unknown>;
  const common = toVerses(st.ar ?? Object.values(st)[0], entry.sectionName);
  const tracks = TRACKS.filter(([f]) => typeof entry[f] === "string" && (entry[f] as string).trim()).map(([f, label, key]) => {
    const own = st[key] !== undefined ? toVerses(st[key], entry.sectionName) : undefined;
    return { label, src: (entry[f] as string).trim(), verses: own && JSON.stringify(own) !== JSON.stringify(common) ? own : undefined };
  });
  if (!tracks.length) return null;
  return { title: title || undefined, tracks: tracks.slice(0, 20), verses: common, icon: "music" };
}

function outlineToToc(nodes: FOutline[], level = 1, out: TocEntry[] = []): TocEntry[] {
  for (const n of nodes) {
    const page = Number(n.page);
    const title = decodeHtml(String(n.caption ?? "")).trim().slice(0, 300);
    if (title && page >= 1) out.push({ title, page, level: Math.min(4, level) });
    if (n.children?.length) outlineToToc(n.children, level + 1, out);
  }
  return out;
}

const urlOf = (l: Record<string, unknown>) => {
  const url = String(l.url ?? "").trim();
  if (!url) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `${String(l.urlHead ?? "https://") || "https://"}${url.replace(/^\/\//, "")}`;
};

export async function convertFlipHtml5(
  src: FlipSource,
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<{ book: FlipResult; report: FlipReport }> {
  const editorText = await src.text("files/pageEditor.js");
  if (!editorText) throw new Error("FlipHTML5 책 폴더가 아니에요. files/pageEditor.js가 들어 있는 폴더(또는 zip)를 골라 주세요.");
  const editor = parseJsData<FEditor>(editorText);
  if (!Array.isArray(editor.pages) || !editor.pages.length) throw new Error("쪽 정보를 찾지 못했어요.");
  const PW = editor.pageConfig?.pageWidth || 625;
  const PH = editor.pageConfig?.pageHeight || 825;
  const size = sizeForAspect(PW, PH);
  const kx = size.width / PW;
  const ky = size.height / PH;

  const html = (await src.text("index.html")) ?? "";
  const title = decodeHtml(/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "").trim() || "가져온 플립북";

  let texts: string[] = [];
  try {
    const t = await src.text("files/search/search_config.js");
    if (t) texts = parseJsData<string[]>(t, "[").map((x) => decodeHtml(String(x ?? "")).trim());
  } catch {
    /* 검색 글 없음 */
  }
  let toc: TocEntry[] = [];
  try {
    const t = await src.text("files/search/bookmark_config.js");
    if (t) toc = outlineToToc(parseJsData<FOutline[]>(t, "["));
  } catch {
    /* 목차 없음 */
  }
  let videos: Record<string, VideoEntry> = {};
  try {
    const t = await src.text("Sekwang_Popup/maintenance/videoList.js");
    if (t) videos = parseJsData<Record<string, VideoEntry>>(t);
  } catch {
    /* 세광 플레이어 아님 */
  }

  const report: FlipReport = { pages: 0, links: 0, icons: 0, players: 0, skipped: {}, missing: 0 };
  const skip = (k: string) => (report.skipped[k] = (report.skipped[k] ?? 0) + 1);
  const uploaded = new Map<string, Promise<string | null>>();
  const up = (path: string) => {
    if (!uploaded.has(path)) uploaded.set(path, src.exists(path) ? src.upload(path) : Promise.resolve(null));
    return uploaded.get(path)!;
  };
  const asset = async (name: string | undefined) => {
    if (!name) return null;
    const b = base(name);
    const url = (await up(`files/pageConfig/${b}`)) ?? (await up(`files/extfile/${b}`));
    if (!url) report.missing++;
    return url;
  };

  // 쪽 그림과 아이콘·팝업 파일을 미리 올리기 시작한다 (올리는 쪽에서 동시에 몇 개씩 처리)
  for (const fp of editor.pages) {
    const n = base(fp.backgroundImage ?? "");
    if (n && src.exists(`files/large/${n}`)) void up(`files/large/${n}`).catch(() => null);
    for (const it of fp.items ?? []) {
      const names = [it.fileName, ...(it.actionList ?? []).flatMap((a) => ((a.popupImg?.imgList as { fileName?: string }[] | undefined) ?? []).map((x) => x.fileName)), ...(it.musicList ?? []).map((m) => m.fileName)];
      for (const nm of names) if (nm && src.exists(`files/pageConfig/${base(nm)}`)) void up(`files/pageConfig/${base(nm)}`).catch(() => null);
    }
  }

  // 쪽 위치: FlipHTML5 좌표(쪽 너비 PW 기준 px) → 책 px. 두 쪽 편집기에서 만든 요소는 쪽 너비만큼 밀려 있어 되돌린다
  const box = (st: Record<string, string | number> = {}) => {
    let x = px(st.left);
    const y = px(st.top);
    const w = Math.max(6, px(st.width) || 30);
    const h = Math.max(6, px(st.height) || 30);
    if (x >= PW) x -= PW;
    return {
      x: Math.round(Math.max(0, Math.min(PW - w, x)) * kx),
      y: Math.round(Math.max(0, Math.min(PH - h, y)) * ky),
      w: Math.round(Math.min(PW, w) * kx),
      h: Math.round(Math.min(PH, h) * ky),
    };
  };

  async function actionOf(list: FItem["actionList"]): Promise<BlockAction | undefined> {
    for (const a of list ?? []) {
      if (a.openPage) {
        const page = Number(a.openPage.page);
        if (page >= 1) return { type: "page", page: Math.min(page, editor.pages.length) };
      }
      if (a.linkList) {
        const href = urlOf(a.linkList);
        if (href) return { type: "url", href };
      }
      if (a.phone?.phoneNumber) return { type: "url", href: `tel:${String(a.phone.phoneNumber).replace(/[^0-9+\-]/g, "")}` };
      if (a.email || a.mailTo) {
        const m = (a.email ?? a.mailTo) as Record<string, unknown>;
        const addr = String(m.email ?? m.mail ?? m.url ?? "").trim();
        if (addr) return { type: "url", href: addr.startsWith("mailto:") ? addr : `mailto:${addr}` };
      }
      if (a.popupImg) {
        const list = (a.popupImg.imgList as { fileName?: string; url?: string; title?: string }[] | undefined) ?? [];
        const urls = (await Promise.all(list.map((i) => asset(i.fileName ?? i.url)))).filter((u): u is string => !!u);
        if (urls.length) return { type: "popup", title: list[0]?.title || undefined, image: urls[0], images: urls.length > 1 ? urls.slice(0, 30) : undefined, allowSave: !!a.popupImg.imgCanBeSave || undefined };
      }
      if (a.popupVideo) {
        const v = (a.popupVideo.videoInfo ?? {}) as Record<string, string>;
        const video = v.youTubeId || v.vimeoId || v.link || (v.localLink ? await asset(v.localLink) : null);
        if (video) return { type: "popup", title: v.title || undefined, video };
      }
      if (a.iframe) {
        const url = String(a.iframe.url ?? "");
        if (/^https?:/i.test(url)) return { type: "url", href: url };
      }
    }
    return undefined;
  }

  const pages: Page[] = [];
  const total = editor.pages.length;
  for (const [pi, fp] of editor.pages.entries()) {
    onProgress?.(pi, total, "쪽 옮기는 중…");
    const bgName = base(fp.backgroundImage ?? "");
    const bg = bgName ? (await up(`files/large/${bgName}`)) ?? (await up(`files/thumb/${bgName}`)) : null;
    if (bgName && !bg) report.missing++;
    const blocks: Block[] = [];
    for (const it of fp.items ?? []) {
      const b = box(it.style);
      if (it.type === "link") {
        const action = await actionOf(it.actionList);
        if (!action) {
          skip("동작 없는 링크");
          continue;
        }
        blocks.push({ id: newId(), type: "hotspot", ...b, data: { pulse: false }, action });
        report.links++;
      } else if (it.type === "image") {
        const icon = await asset(it.fileName);
        const action = await actionOf(it.actionList);
        if (!icon && !action) {
          skip("그림");
          continue;
        }
        if (icon) blocks.push({ id: newId(), type: "image", ...b, data: { src: icon, alt: it.name ?? "", fit: "contain" }, action });
        else blocks.push({ id: newId(), type: "icon", ...b, data: { icon: action?.type === "popup" && action.video ? "video" : "activity" }, action });
        report.icons++;
      } else if (it.type === "pluginMusic") {
        // 세광: iframe으로 inner-player.html?videoUrl=키 를 연다
        const frame = it.actionList?.find((a) => a.iframe)?.iframe;
        const key = frame ? new URLSearchParams(String(frame.url ?? "").split("?")[1] ?? "").get("videoUrl") : null;
        const entry = key ? videos[key] : undefined;
        // 요소 이름이 "오디오"·"음악" 같은 기본 이름이면 제목으로 쓰지 않는다
        const named = it.name && !/^(pluginMusic|오디오|음악|audio|music|사운드)\s*(\(\d+\))?$/i.test(it.name.trim()) ? it.name.trim() : "";
        let data = entry ? playerFromVideo(entry, named) : null;
        if (!data && it.musicList?.length) {
          const tracks = (await Promise.all(it.musicList.slice(0, 20).map(async (m, k) => ({ label: m.name?.replace(/\.[a-z0-9]+$/i, "").slice(0, 30) || `트랙 ${k + 1}`, src: (await asset(m.fileName ?? m.url)) ?? "" })))).filter((t) => t.src);
          if (tracks.length) data = { title: tracks[0].label, tracks, verses: [], icon: "headphones" };
        }
        if (data) {
          const side = Math.max(b.w, b.h, 28);
          blocks.push({ id: newId(), type: "player", ...b, w: side, h: side, data });
          report.players++;
        } else {
          const action = await actionOf(it.actionList);
          if (action) blocks.push({ id: newId(), type: "icon", ...b, data: { icon: "music" }, action });
          else skip("음악(파일 없음)");
        }
      } else skip(it.type);
    }
    const st = typeof fp.searchMapIndex === "number" ? texts[fp.searchMapIndex] : texts[pi];
    pages.push({ id: newId("p"), layoutId: "blank", background: { color: "#ffffff", imageUrl: bg ?? undefined }, searchText: st || undefined, blocks });
    report.pages++;
  }
  onProgress?.(total, total, "책 만드는 중…");
  return {
    book: { title, size, pages, toc: toc.filter((e) => e.page <= pages.length).slice(0, 500) },
    report,
  };
}

/** 변환 결과 → 저장할 Book */
export function flipBook(result: FlipResult, theme: Book["theme"]): Book {
  return {
    id: "new",
    title: result.title.slice(0, 100),
    language: "ko",
    bookType: "textbook",
    size: result.size,
    theme: { ...theme, background: "#ffffff" },
    outline: { chapters: [] },
    pages: result.pages,
    toc: result.toc?.length ? result.toc : undefined,
    meta: {},
  };
}
