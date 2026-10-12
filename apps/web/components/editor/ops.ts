import { createPage, newId } from "@ebook/layouts";
import type { Block, Book, LayoutId, Page } from "@ebook/schema";

// 에디터 편집 동작 — 모두 새 Book을 돌려주는 순수 함수 (undo 기록이 그대로 쌓이도록)

export function updatePage(book: Book, pageId: string, fn: (p: Page) => Page): Book {
  return { ...book, pages: book.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

export function updateBlock(book: Book, pageId: string, blockId: string, fn: (b: Block) => Block): Book {
  return updatePage(book, pageId, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));
}

export type NewBlockKind =
  | "heading" | "paragraph" | "list" | "quote" | "image" | "rect" | "ellipse" | "line" | "link"
  | "video" | "audio" | "slideshow" | "product" | "button" | "hotspot" | "embed";

export const NEW_BLOCK_LABELS: Record<NewBlockKind, string> = {
  heading: "제목",
  paragraph: "본문",
  list: "목록",
  quote: "인용",
  image: "이미지",
  rect: "사각형",
  ellipse: "원",
  line: "선",
  link: "링크",
  video: "동영상",
  audio: "오디오",
  slideshow: "슬라이드쇼",
  product: "상품 태그",
  button: "버튼",
  hotspot: "핫스팟(클릭 영역)",
  embed: "웹 삽입",
};

/** 페이지 가운데에 새 블록을 만든다 */
export function makeBlock(kind: NewBlockKind, book: Book): Block {
  const { width: W, height: H } = book.size;
  const box = (w: number, h: number) => ({ id: newId(), x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w: Math.round(w), h: Math.round(h) });
  switch (kind) {
    case "heading":
      return { ...box(W * 0.8, 60), type: "heading", data: { text: "제목을 입력하세요", level: 2 } };
    case "paragraph":
      return { ...box(W * 0.8, 120), type: "paragraph", data: { text: "본문을 입력하세요. 더블클릭하면 바로 고칠 수 있어요." } };
    case "list":
      return { ...box(W * 0.8, 110), type: "list", data: { items: ["첫 번째 항목", "두 번째 항목", "세 번째 항목"], ordered: false } };
    case "quote":
      return { ...box(W * 0.8, 110), type: "quote", data: { text: "마음에 남는 한 문장", cite: "" } };
    case "image":
      return { ...box(W * 0.5, H * 0.3), type: "image", data: { src: "", alt: "", fit: "cover" } };
    case "rect":
      return { ...box(W * 0.3, H * 0.15), type: "shape", data: { kind: "rect" } };
    case "ellipse":
      return { ...box(W * 0.2, W * 0.2), type: "shape", data: { kind: "ellipse" } };
    case "line":
      return { ...box(W * 0.5, 4), type: "shape", data: { kind: "line" } };
    case "link":
      return { ...box(W * 0.4, 32), type: "link", data: { text: "링크 텍스트", href: "https://" } };
    case "video":
      return { ...box(W * 0.7, W * 0.7 * 0.5625), type: "video", data: { src: "" } };
    case "audio":
      return { ...box(W * 0.5, 56), type: "audio", data: { src: "", title: "오디오 재생" } };
    case "slideshow":
      return { ...box(W * 0.7, H * 0.35), type: "slideshow", data: { images: [], fit: "cover", autoplay: 0 } };
    case "product":
      return { ...box(48, 48), type: "product", data: { name: "상품 이름", price: "₩10,000", description: "상품 설명을 적어 주세요.", buttonText: "구매하기" } };
    case "button":
      return { ...box(W * 0.3, 52), type: "button", data: { text: "자세히 보기", variant: "solid" }, action: { type: "url", href: "https://" } };
    case "hotspot":
      return { ...box(W * 0.3, H * 0.15), type: "hotspot", data: { pulse: false }, action: { type: "popup", title: "제목", text: "눌렀을 때 보여 줄 내용" } };
    case "embed":
      return { ...box(W * 0.8, H * 0.35), type: "embed", data: { url: "https://" } };
  }
}

export function addBlock(book: Book, pageId: string, block: Block): Book {
  return updatePage(book, pageId, (p) => ({ ...p, blocks: [...p.blocks, block] }));
}

export function deleteBlock(book: Book, pageId: string, blockId: string): Book {
  return updatePage(book, pageId, (p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== blockId) }));
}

export function duplicateBlock(book: Book, pageId: string, blockId: string): { book: Book; id: string | null } {
  const page = book.pages.find((p) => p.id === pageId);
  const src = page?.blocks.find((b) => b.id === blockId);
  if (!src) return { book, id: null };
  const copy = { ...structuredClone(src), id: newId(), slot: undefined, x: src.x + 20, y: src.y + 20 } as Block;
  return { book: addBlock(book, pageId, copy), id: copy.id };
}

/** 블록 쌓임 순서 — 배열 뒤에 있을수록 위에 그려진다 */
export function reorderBlock(book: Book, pageId: string, blockId: string, to: "front" | "back" | "forward" | "backward"): Book {
  return updatePage(book, pageId, (p) => {
    const i = p.blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return p;
    const blocks = [...p.blocks];
    const [b] = blocks.splice(i, 1);
    const j = to === "front" ? blocks.length : to === "back" ? 0 : to === "forward" ? Math.min(i + 1, blocks.length) : Math.max(i - 1, 0);
    blocks.splice(j, 0, b);
    return { ...p, blocks };
  });
}

export function insertPage(book: Book, afterIndex: number, layoutId: LayoutId): { book: Book; page: Page } {
  const page = createPage(layoutId, book.size);
  const pages = [...book.pages];
  pages.splice(afterIndex + 1, 0, page);
  return { book: { ...book, pages }, page };
}

export function duplicatePage(book: Book, index: number): { book: Book; page: Page } {
  const src = book.pages[index];
  const page: Page = { ...structuredClone(src), id: newId("p"), blocks: src.blocks.map((b) => ({ ...structuredClone(b), id: newId() })) };
  const pages = [...book.pages];
  pages.splice(index + 1, 0, page);
  return { book: { ...book, pages }, page };
}

export function deletePage(book: Book, index: number): Book {
  if (book.pages.length <= 1) return book;
  return { ...book, pages: book.pages.filter((_, i) => i !== index) };
}

export function movePage(book: Book, from: number, to: number): Book {
  if (from === to || to < 0 || to >= book.pages.length) return book;
  const pages = [...book.pages];
  const [p] = pages.splice(from, 1);
  pages.splice(to, 0, p);
  return { ...book, pages };
}

/** 블록 style에서 키를 지우거나(값이 비면) 바꾼다 */
export function setStyle(block: Block, key: string, value: string | number | undefined): Block {
  const style = { ...(block.style ?? {}) };
  if (value === undefined || value === "") delete style[key];
  else style[key] = value;
  return { ...block, style: Object.keys(style).length ? style : undefined };
}
