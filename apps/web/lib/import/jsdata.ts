// `var x = {...};` 꼴 자바스크립트 데이터 파일을 코드 실행 없이 읽는다 (올린 파일을 eval하면 위험하므로).
// 문자열 밖의 // · /* */ 주석과 끝에 붙은 쉼표를 지운 뒤 JSON으로 읽는다.

export function stripJsComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** 첫 여는 괄호({ 또는 [)부터 마지막 닫는 괄호까지를 JSON으로 읽는다 */
export function parseJsData<T = unknown>(src: string, open: "{" | "[" = "{"): T {
  const close = open === "{" ? "}" : "]";
  const clean = stripJsComments(src);
  const a = clean.indexOf(open);
  const b = clean.lastIndexOf(close);
  if (a < 0 || b < a) throw new Error("데이터를 찾지 못했어요.");
  const body = clean
    .slice(a, b + 1)
    .replace(/,(\s*[}\]])/g, "$1") // 끝 쉼표
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s: string) => JSON.stringify(s.replace(/\\'/g, "'"))); // 작은따옴표 문자열
  return JSON.parse(body) as T;
}
