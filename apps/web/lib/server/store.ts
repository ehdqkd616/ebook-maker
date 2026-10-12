import path from "node:path";
import { Store } from "@ebook/db";

// 개발 서버 HMR로 모듈이 다시 로드돼도 DB 연결은 하나만 쓴다.
const g = globalThis as unknown as { __ebookStore?: Store };

export function getStore() {
  g.__ebookStore ??= new Store(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
  return g.__ebookStore;
}
