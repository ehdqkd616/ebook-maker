import { FONTS, setTextMeasurer } from "@ebook/layouts";

// 조판 엔진(@ebook/layouts)이 글자 폭을 추정 대신 실제 웹폰트로 재도록 canvas 측정기를 넣는다.
// 글꼴 파일이 다 내려온 뒤에 재야 정확하므로, 책 테마 글꼴을 먼저 불러 둔다.

let ready: Promise<void> | null = null;

export function installTextMeasurer(): Promise<void> {
  ready ??= (async () => {
    const families = Object.values(FONTS).map((f) => f.css);
    await Promise.all(
      families.flatMap((fam) => [`17px ${fam}`, `700 20px ${fam}`, `22px ${fam}`].map((spec) => document.fonts.load(spec, "가A").catch(() => []))),
    );
    await document.fonts.ready;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    const cache = new Map<string, number>();
    let current = "";
    setTextMeasurer((text, px, family) => {
      const font = `${px}px ${family}`;
      const key = `${font}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      if (current !== font) {
        ctx.font = font;
        current = font;
      }
      const w = ctx.measureText(text).width;
      if (cache.size > 50_000) cache.clear();
      cache.set(key, w);
      return w;
    });
  })();
  return ready;
}
