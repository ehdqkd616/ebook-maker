import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bad } from "./http";
import { storageDir } from "./store";

// 책에 넣는 이미지. JSON(data URL)으로 받아 storage/uploads에 저장하고 /api/files/<이름>으로 내준다.
// 공개 플립북에서도 보여야 하므로 파일 주소는 추측할 수 없는 무작위 이름만 쓴다.
// SVG는 스크립트를 품을 수 있어 받지 않는다.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const TYPES = {
  png: { mime: "image/png", magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: "image/jpeg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  gif: { mime: "image/gif", magic: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  webp: { mime: "image/webp", magic: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
} as const;
type Ext = keyof typeof TYPES;

const uploadDir = () => path.join(storageDir(), "uploads");
export const FILE_NAME_RE = /^[a-f0-9]{32}\.(png|jpg|gif|webp)$/;

export async function saveImage(dataUrl: unknown) {
  const m = typeof dataUrl === "string" ? /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) throw bad("이미지 파일을 읽을 수 없습니다.", "BAD_IMAGE");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_UPLOAD_BYTES) throw bad("이미지는 8MB까지 올릴 수 있습니다.", "IMAGE_TOO_LARGE");
  const ext = (Object.keys(TYPES) as Ext[]).find((k) => TYPES[k].magic(buf));
  if (!ext) throw bad("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.", "UNSUPPORTED_IMAGE");
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(uploadDir(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(uploadDir(), name), buf, { mode: 0o600 });
  return { url: `/api/files/${name}`, bytes: buf.length };
}

export async function readImage(name: string) {
  if (!FILE_NAME_RE.test(name)) return null;
  const ext = name.split(".")[1] as Ext;
  try {
    return { body: await readFile(path.join(uploadDir(), name)), mime: TYPES[ext].mime };
  } catch {
    return null;
  }
}
