// 뷰어 배경 프리셋 — 그림 파일 없이 CSS만으로. 설정에는 "preset:이름"으로 저장한다.
export const BG_PRESETS: Record<string, { name: string; css: string; light?: boolean }> = {
  night: { name: "밤 무대", css: "radial-gradient(120% 80% at 50% 0%, #3b3550, #16141f 70%)" },
  paper: {
    name: "종이",
    light: true,
    css: "radial-gradient(60% 50% at 30% 20%, rgba(255,255,255,.55), transparent 70%), radial-gradient(50% 60% at 80% 90%, rgba(150,120,80,.10), transparent 70%), repeating-linear-gradient(0deg, rgba(90,70,40,.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(90,70,40,.02) 0 1px, transparent 1px 4px), #ece5d8",
  },
  desk: {
    name: "나무 책상",
    css: "repeating-linear-gradient(92deg, rgba(0,0,0,.06) 0 2px, transparent 2px 19px, rgba(255,255,255,.04) 19px 21px, transparent 21px 37px), linear-gradient(180deg, #8b5e3c, #5f3c22)",
  },
  chalk: { name: "칠판", css: "radial-gradient(90% 70% at 50% 40%, #35624c, #1d3a2d 75%), #1d3a2d" },
  light: { name: "밝은 회색", light: true, css: "linear-gradient(180deg, #f5f5f8, #e4e4ec)" },
  ocean: { name: "깊은 바다", css: "radial-gradient(110% 80% at 50% 0%, #1f4f7a, #0c1b2e 70%)" },
};
