import { api } from "./api";

// 브라우저에서 이미지를 골라 서버에 올린다. 큰 사진은 올리기 전에 줄인다 (책 페이지 폭의 2배면 충분).

const MAX_SIDE = 2400;
const SHRINK_OVER_BYTES = 1.5 * 1024 * 1024;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    r.readAsDataURL(blob);
  });

async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file; // 움직이는 GIF는 그대로
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (k === 1 && file.size <= SHRINK_OVER_BYTES) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
  return blob && blob.size < file.size ? blob : file;
}

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 넣을 수 있습니다.");
  return uploadBlob(await shrink(file));
}

/** 이미 알맞은 크기로 만든 이미지(Blob)를 그대로 올린다 — PDF 쪽 이미지, Word 안 그림 */
export async function uploadBlob(blob: Blob): Promise<string> {
  const { url } = await api<{ url: string }>("/api/uploads", { body: { dataUrl: await readAsDataUrl(blob) } });
  return url;
}

/** 오디오·동영상 올리기 (30MB까지) */
export async function uploadMedia(file: File): Promise<string> {
  if (!/^(audio|video)\//.test(file.type)) throw new Error("오디오나 동영상 파일만 넣을 수 있습니다.");
  if (file.size > 30 * 1024 * 1024) throw new Error("오디오·동영상은 30MB까지 올릴 수 있어요. 더 큰 동영상은 YouTube에 올리고 주소를 넣어 주세요.");
  return uploadBlob(file);
}

/** 파일 선택 창을 띄워 하나를 고르게 한다 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** 여러 파일 고르기 (슬라이드쇼 사진 등) */
export function pickFiles(accept: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

/** 파일 선택 창을 띄워 이미지 하나를 고르게 한다 */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
