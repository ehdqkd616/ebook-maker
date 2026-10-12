import { describe, expect, it } from "vitest";
import { LAYOUT_IDS, SIZE_PRESETS } from "@ebook/schema";
import { getLayout, placeBlocks } from "./index";

const A4 = SIZE_PRESETS.A4;

describe("placeBlocks", () => {
  it("converts slot ratio boxes to px for the book size", () => {
    const [title] = placeBlocks(getLayout("cover"), A4, {
      title: { type: "heading", data: { text: "제목", level: 1 } },
    });
    expect(title).toMatchObject({ slot: "title", x: 79, y: 337, w: 635, h: 270 });
  });

  it("rejects missing required slots, unknown slots and wrong block types", () => {
    const layout = getLayout("text-1col");
    const body = { type: "paragraph", data: { text: "본문" } } as const;
    expect(() => placeBlocks(layout, A4, {})).toThrow(/required slot "body"/);
    expect(() => placeBlocks(layout, A4, { body, nope: body })).toThrow(/unknown slot/);
    expect(() =>
      placeBlocks(layout, A4, { body: { type: "image", data: { src: "x.png", alt: "", fit: "cover" } } }),
    ).toThrow(/does not accept image/);
  });

  it("defines every layout id in the schema", () => {
    for (const id of LAYOUT_IDS) expect(getLayout(id).id).toBe(id);
  });
});
