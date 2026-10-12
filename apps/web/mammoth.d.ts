// mammoth 브라우저 번들은 타입을 따로 배포하지 않아 쓰는 부분만 선언한다.
declare module "mammoth/mammoth.browser.js" {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  };
  export default mammoth;
}
