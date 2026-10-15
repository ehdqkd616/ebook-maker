// 브라우저에서 zip 읽기 (저장·deflate). 압축 풀기는 브라우저 내장 DecompressionStream을 쓴다.

export type ZipFile = { name: string; size: number; blob: () => Promise<Blob> };

export async function readZip(file: Blob): Promise<ZipFile[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // 끝에서 중앙 디렉터리 끝 표시(EOCD)를 찾는다
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip 파일을 읽지 못했어요.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipFile[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("zip 목록이 깨졌어요.");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const rawName = buf.subarray(p + 46, p + 46 + nlen);
    // 이름이 UTF-8이 아니면(윈도 한글 zip) EUC-KR로 읽어 본다
    let name = dec.decode(rawName);
    if (!(flags & 0x0800) && name.includes("�")) {
      try {
        name = new TextDecoder("euc-kr").decode(rawName);
      } catch {
        /* 그대로 */
      }
    }
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    const lnlen = dv.getUint16(local + 26, true);
    const lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    const data = buf.subarray(start, start + csize);
    out.push({
      name,
      size: usize,
      blob: async () => {
        if (method === 0) return new Blob([data as BlobPart]);
        if (method !== 8) throw new Error(`지원하지 않는 압축 방식이에요 (${name}).`);
        const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Response(stream).blob();
      },
    });
  }
  return out;
}
