import { describe, expect, it } from "vitest";
import { Block } from "./index";

describe("Block", () => {
  it("validates data by block type", () => {
    const base = { id: "b1", x: 0, y: 0, w: 100, h: 50 };
    expect(Block.safeParse({ ...base, type: "heading", data: { text: "제목", level: 1 } }).success).toBe(true);
    expect(Block.safeParse({ ...base, type: "heading", data: { text: "제목" } }).success).toBe(false);
    expect(Block.safeParse({ ...base, type: "unknown", data: {} }).success).toBe(false);
  });

  it("fills defaults", () => {
    const b = Block.parse({ id: "b1", x: 0, y: 0, w: 1, h: 1, type: "list", data: { items: ["a"] } });
    expect(b.type === "list" && b.data.ordered).toBe(false);
  });
});
