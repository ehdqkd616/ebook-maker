// page-flip은 타입 선언을 배포하지 않으므로 사용하는 부분만 선언한다.
declare module "page-flip" {
  export type FlipEvent = { data: number; object: PageFlip };
  export class PageFlip {
    constructor(block: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(event: "flip" | "changeOrientation" | "changeState" | "init", cb: (e: FlipEvent) => void): this;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    flip(page: number): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    destroy(): void;
  }
}
