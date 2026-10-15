import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getThemePreset } from "@ebook/layouts";
import { Book } from "@ebook/schema";
import { convertFlipHtml5, flipBook } from "./fliphtml5";
import { parseJsData, stripJsComments } from "./jsdata";

describe("jsdata", () => {
  it("문자열 안의 //는 두고 주석만 지운다", () => {
    expect(stripJsComments('var a = {"u": "https://x.y/z"} // 끝')).toBe('var a = {"u": "https://x.y/z"} ');
    expect(parseJsData<{ a: number[] }>("v = { 'a': [1, 2,], /* c */ };")).toEqual({ a: [1, 2] });
  });
});

// 세광 교과서 폴더가 옆에 있으면 실제로 바꿔 본다 (CI에는 없으므로 건너뛴다)
const ROOT = "/home/user/segwang_ebook_project1";
describe.skipIf(!existsSync(ROOT))("FlipHTML5 가져오기 — 세광 중학 음악 1", () => {
  it("쪽·목차·검색 글·링크·아이콘 팝업·악보 플레이어를 옮긴다", async () => {
    const uploads: string[] = [];
    const { book, report } = await convertFlipHtml5({
      text: async (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), "utf8") : null),
      exists: (p) => existsSync(path.join(ROOT, p)),
      upload: async (p) => {
        uploads.push(p);
        return `/api/files/${p.replace(/\W/g, "_")}`;
      },
    });
    const doc = flipBook(book, getThemePreset("classic-navy").theme);
    const parsed = Book.safeParse(doc);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
    expect(report.pages).toBe(124);
    expect(report.missing).toBe(0);
    expect(doc.title).toContain("음악");
    expect(doc.toc?.length).toBeGreaterThan(10);
    const blocks = doc.pages.flatMap((p) => p.blocks);
    // 링크 84개(쪽 이동 76·웹 5·전화 3), 그림 아이콘 140개, 음악 94개
    expect(report.links).toBe(84);
    expect(blocks.filter((b) => b.action?.type === "url" && b.action.href.startsWith("tel:")).length).toBe(3);
    expect(blocks.filter((b) => b.type === "hotspot" && b.action?.type === "page").length).toBe(76);
    const players = blocks.filter((b) => b.type === "player");
    expect(players.length).toBe(report.players);
    expect(report.players).toBeGreaterThan(80);
    const p = players.find((b) => b.type === "player" && b.data.tracks.length >= 2);
    expect(p?.type === "player" && p.data.tracks.map((t) => t.label)).toEqual(expect.arrayContaining(["노래 듣기", "반주 듣기"]));
    const popups = blocks.filter((b) => b.action?.type === "popup");
    expect(popups.some((b) => b.action?.type === "popup" && b.action.video?.includes("youtu"))).toBe(true);
    expect(popups.some((b) => b.action?.type === "popup" && b.action.allowSave)).toBe(true);
    // 모든 요소가 쪽 안에
    for (const b of blocks) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(doc.size.width + 1);
      expect(b.y + b.h).toBeLessThanOrEqual(doc.size.height + 1);
    }
    expect(doc.pages.filter((pg) => pg.searchText).length).toBeGreaterThan(100);
    // 같은 파일은 한 번만 올린다
    expect(new Set(uploads).size).toBe(uploads.length);
    console.log("report", JSON.stringify(report), "uploads", uploads.length);
  });
});
