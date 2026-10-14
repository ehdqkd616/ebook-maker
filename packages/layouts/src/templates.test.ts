import { describe, expect, it } from "vitest";
import { Book } from "@ebook/schema";
import { bookFromTemplate, TEMPLATES } from "./templates";

describe("템플릿", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s — 올바른 책을 만들고 얹은 요소가 쪽 안에 있다", (_id, t) => {
    const book = bookFromTemplate(t);
    const parsed = Book.safeParse(book);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
    expect(book.pages.length).toBeGreaterThan(2);
    for (const p of book.pages)
      for (const b of p.blocks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y + b.h).toBeLessThanOrEqual(book.size.height);
        expect(b.x + b.w).toBeLessThanOrEqual(book.size.width);
      }
    const extras = Object.values(t.extras ?? {}).flat().length;
    const interactive = book.pages.flatMap((p) => p.blocks).filter((b) => ["product", "form", "button"].includes(b.type)).length;
    expect(interactive).toBe(extras);
    for (const b of book.pages.flatMap((p) => p.blocks)) if (b.action?.type === "page") expect(b.action.page).toBeGreaterThan(1);
  });

  it("에세이는 챕터마다 첫 본문 문단에 첫 글자 장식이 붙는다", () => {
    const book = bookFromTemplate(TEMPLATES.find((t) => t.id === "essay")!);
    const caps = book.pages.flatMap((p) => p.blocks).filter((b) => b.type === "paragraph" && b.data.dropCap);
    expect(caps.length).toBe(3);
  });
});

import { crc32, zip } from "../../../apps/web/lib/export/zip";
describe("zip", () => {
  it("crc32 표준값", () => expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
  it("저장 방식 zip — 시그니처·항목 수", () => {
    const z = zip([{ name: "mimetype", data: new TextEncoder().encode("application/epub+zip") }, { name: "a/b.txt", data: new Uint8Array([1, 2, 3]) }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(z.slice(30, 38))).toBe("mimetype");
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
  });
});
