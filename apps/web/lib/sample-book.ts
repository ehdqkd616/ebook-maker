import { getLayout, placeBlocks, type SlotContent } from "@ebook/layouts";
import { SIZE_PRESETS, type Book, type LayoutId, type Page } from "@ebook/schema";

// 1주차용 하드코딩 샘플. 7장 AI 파이프라인이 붙으면 이 자리를 생성 결과가 대신한다.

const size = { preset: "A4" as const, ...SIZE_PRESETS.A4 };

const heading = (text: string, level: 1 | 2 | 3 = 2): SlotContent => ({ type: "heading", data: { text, level } });
const paragraph = (text: string): SlotContent => ({ type: "paragraph", data: { text } });

let pageNo = 0;
function page(layoutId: LayoutId, slots: Record<string, SlotContent>, chapterId?: string): Page {
  const id = `p${++pageNo}`;
  return { id, layoutId, chapterId, blocks: placeBlocks(getLayout(layoutId), size, slots, (slot) => `${id}-${slot}`) };
}

export const sampleBook: Book = {
  id: "sample",
  title: "처음 배우는 음악 이론",
  subtitle: "악보 읽기부터 화음까지, 한 권으로 시작하는 음악의 언어",
  language: "ko",
  bookType: "textbook",
  size,
  theme: {
    templateId: "textbook-clean",
    primary: "#2f4b8f",
    secondary: "#f2b134",
    background: "#fffdf8",
    text: "#1f2430",
    headingFont: "'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif",
    bodyFont: "'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif",
  },
  meta: { audience: "음악을 처음 배우는 중학생", style: "friendly", tone: "inspiring", targetPages: 8 },
  outline: {
    chapters: [
      {
        id: "ch1",
        title: "소리와 음표",
        summary: "음악을 이루는 가장 작은 단위인 소리의 높이와 길이를 알아보고, 이를 악보에 적는 방법을 배웁니다.",
        keyPoints: ["음의 높이와 길이", "오선과 음자리표", "음표와 쉼표"],
      },
      {
        id: "ch2",
        title: "음계와 화음",
        summary: "음들이 모여 음계를 이루고, 여러 음이 동시에 울려 화음이 되는 원리를 살펴봅니다.",
        keyPoints: ["장음계의 구조", "3화음 만들기", "주요 3화음"],
      },
    ],
  },
  pages: [
    page("cover", {
      title: heading("처음 배우는\n음악 이론", 1),
      subtitle: paragraph("악보 읽기부터 화음까지, 한 권으로 시작하는 음악의 언어"),
      author: paragraph("Ebook Maker 샘플"),
    }),
    page(
      "chapter-opener",
      {
        number: heading("Chapter 1", 3),
        title: heading("소리와 음표", 1),
        summary: paragraph("음악을 이루는 가장 작은 단위인 소리의 높이와 길이를 알아보고, 이를 악보에 적는 방법을 배웁니다."),
      },
      "ch1",
    ),
    page(
      "text-1col",
      {
        heading: heading("음의 높이와 길이"),
        body: paragraph(
          "우리가 듣는 모든 소리에는 높이와 길이가 있습니다. 피아노의 오른쪽 건반을 누르면 높은 소리가, 왼쪽 건반을 누르면 낮은 소리가 납니다. 소리의 높이는 공기가 1초에 몇 번 떨리는지, 즉 진동수로 정해집니다.\n\n소리의 길이는 음이 얼마나 오래 이어지는지를 말합니다. 같은 높이의 음이라도 짧게 끊어 치면 경쾌하게, 길게 이어 치면 부드럽게 들립니다. 음악은 결국 이 높이와 길이를 시간 위에 배치하는 예술이라고 할 수 있어요.\n\n이 두 가지를 다른 사람과 정확하게 나누기 위해 사람들은 오랜 시간에 걸쳐 악보라는 약속을 만들었습니다. 다음 페이지에서 그 약속을 하나씩 살펴봅시다.",
        ),
      },
      "ch1",
    ),
    page(
      "text-1col",
      {
        heading: heading("악보를 읽는 세 가지 약속"),
        body: {
          type: "list",
          data: {
            ordered: true,
            items: [
              "오선: 다섯 개의 가로줄과 그 사이 공간에 음을 적습니다. 위로 갈수록 높은 음입니다.",
              "음자리표: 오선 맨 앞에 붙어 기준 음을 알려 줍니다. 높은음자리표는 둘째 줄이 '솔'이라는 뜻이에요.",
              "음표와 쉼표: 음표의 모양으로 길이를, 쉼표로 소리를 쉬는 길이를 나타냅니다. 온음표 하나는 2분음표 둘, 4분음표 넷과 같은 길이입니다.",
            ],
          },
        },
      },
      "ch1",
    ),
    page(
      "chapter-opener",
      {
        number: heading("Chapter 2", 3),
        title: heading("음계와 화음", 1),
        summary: paragraph("음들이 모여 음계를 이루고, 여러 음이 동시에 울려 화음이 되는 원리를 살펴봅니다."),
      },
      "ch2",
    ),
    page(
      "text-1col",
      {
        heading: heading("장음계의 구조"),
        body: paragraph(
          "'도레미파솔라시도'처럼 일정한 규칙으로 음을 차례로 늘어놓은 것을 음계라고 합니다. 그중 가장 익숙한 것이 장음계예요.\n\n장음계는 '온음–온음–반음–온음–온음–온음–반음'의 간격으로 이루어집니다. 피아노에서 미와 파, 시와 도 사이에는 검은 건반이 없지요? 바로 그 두 곳이 반음입니다.\n\n이 간격 규칙만 지키면 어떤 음에서 시작해도 장음계를 만들 수 있습니다. 솔에서 시작하면 파에 샵(♯)을 붙여야 규칙이 맞는데, 이것이 바로 조표가 생기는 이유입니다.",
        ),
      },
      "ch2",
    ),
    page(
      "text-1col",
      {
        heading: heading("3화음 만들기"),
        body: paragraph(
          "화음은 두 개 이상의 음이 동시에 울리는 것입니다. 가장 기본이 되는 3화음은 어떤 음 위에 3도씩 두 번 음을 쌓아 만듭니다. 도 위에 미, 미 위에 솔을 쌓으면 '도미솔' 화음이 되지요.\n\n장음계의 첫째(I), 넷째(IV), 다섯째(V) 음 위에 만든 화음을 주요 3화음이라고 부릅니다. 다장조라면 도미솔, 파라도, 솔시레입니다. 이 세 화음만 알아도 수많은 동요와 대중가요의 반주를 할 수 있어요.\n\n다음에 좋아하는 노래를 들을 때, 반주가 어떤 화음으로 움직이는지 귀 기울여 보세요. 음악이 훨씬 입체적으로 들리기 시작할 거예요.",
        ),
      },
      "ch2",
    ),
    page("chapter-opener", {
      number: heading("The End", 3),
      title: heading("다음 걸음", 1),
      summary: paragraph("리듬과 박자, 조성과 전조는 다음 책에서 이어집니다."),
    }),
  ],
};
