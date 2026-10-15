import type { IconName } from "@ebook/schema";

// 활동 아이콘·플레이어 버튼에 쓰는 선 아이콘 (Lucide, ISC 라이선스). 렌더러가 다른 패키지에 기대지 않게 경로만 옮겨 둔다.
type El = ["path", { d: string }] | ["circle", { cx: number; cy: number; r: number }] | ["rect", { x: number; y: number; width: number; height: number; rx?: number }] | ["polygon", { points: string }];

const ICON_PATHS: Record<IconName, El[]> = {
  music: [["path", { d: "M9 18V5l12-2v13" }], ["circle", { cx: 6, cy: 18, r: 3 }], ["circle", { cx: 18, cy: 16, r: 3 }]],
  play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
  video: [["path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }], ["rect", { x: 2, y: 6, width: 14, height: 12, rx: 2 }]],
  headphones: [["path", { d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" }]],
  activity: [
    ["rect", { x: 8, y: 2, width: 8, height: 4, rx: 1 }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
    ["path", { d: "M12 11h4M12 16h4M8 11h.01M8 16h.01" }],
  ],
  book: [["path", { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" }]],
  pencil: [["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }]],
  link: [["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }], ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]],
  info: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 16v-4M12 8h.01" }]],
  question: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  star: [["polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }]],
  image: [["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ["circle", { cx: 9, cy: 9, r: 2 }], ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]],
  download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }], ["path", { d: "m7 10 5 5 5-5M12 15V3" }]],
  mic: [["path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }], ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" }]],
  file: [["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }], ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }]],
};

export const ICON_LABEL: Record<IconName, string> = {
  music: "음악",
  play: "재생",
  video: "동영상",
  headphones: "듣기",
  activity: "활동",
  book: "읽기",
  pencil: "쓰기",
  link: "링크",
  info: "알아보기",
  question: "질문",
  check: "정답",
  star: "중요",
  image: "그림",
  download: "내려받기",
  mic: "말하기",
  file: "자료",
};

export function Icon({ name, className, strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {(ICON_PATHS[name] ?? ICON_PATHS.info).map(([tag, attrs], i) => {
        const Tag = tag;
        return <Tag key={i} {...(attrs as Record<string, string | number>)} />;
      })}
    </svg>
  );
}
