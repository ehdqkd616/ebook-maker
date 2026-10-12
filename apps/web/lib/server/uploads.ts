import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bad } from "./http";
import { storageDir } from "./store";

// 책에 넣는 이미지. JSON(data URL)으로 받아 storage/uploads에 저장하고 /api/files/<이름>으로 내준다.
// 공개 플립북에서도 보여야 하므로 파일 주소는 추측할 수 없는 무작위 이름만 쓴다.
// SVG는 스크립트를 품을 수 있어 받지 않는다.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 30 * 1024 * 1024; // 오디오·동영상

const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString("latin1");
const MEDIA = {
  mp3: { mime: "audio/mpeg", magic: (b: Buffer) => ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  m4a: { mime: "audio/mp4", magic: (b: Buffer) => ascii(b, 4, 8) === "ftyp" && /^(M4A |M4B )/.test(ascii(b, 8, 12)) },
  ogg: { mime: "audio/ogg", magic: (b: Buffer) => ascii(b, 0, 4) === "OggS" },
  wav: { mime: "audio/wav", magic: (b: Buffer) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE" },
  mp4: { mime: "video/mp4", magic: (b: Buffer) => ascii(b, 4, 8) === "ftyp" },
  webm: { mime: "video/webm", magic: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
} as const;
type MediaExt = keyof typeof MEDIA;

const TYPES = {
  png: { mime: "image/png", magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: "image/jpeg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  gif: { mime: "image/gif", magic: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  webp: { mime: "image/webp", magic: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
} as const;
type Ext = keyof typeof TYPES;

const uploadDir = () => path.join(storageDir(), "uploads");
export const FILE_NAME_RE = /^[a-f0-9]{32}\.(png|jpg|gif|webp|mp3|m4a|ogg|wav|mp4|webm)$/;

/** 오디오·동영상 (배경 음악, 오디오·동영상 블록) */
export async function saveMedia(dataUrl: unknown) {
  const m = typeof dataUrl === "string" ? /^data:(?:audio|video)\/[a-z0-9+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) throw bad("오디오·동영상 파일을 읽을 수 없습니다.", "BAD_MEDIA");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_MEDIA_BYTES) throw bad("오디오·동영상은 30MB까지 올릴 수 있습니다.", "MEDIA_TOO_LARGE");
  // m4a를 mp4보다 먼저 본다 (둘 다 ftyp)
  const ext = (["mp3", "m4a", "ogg", "wav", "webm", "mp4"] as MediaExt[]).find((k) => MEDIA[k].magic(buf));
  if (!ext) throw bad("MP3·M4A·OGG·WAV 오디오나 MP4·WEBM 동영상만 올릴 수 있습니다.", "UNSUPPORTED_MEDIA");
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(uploadDir(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(uploadDir(), name), buf, { mode: 0o600 });
  return { url: `/api/files/${name}`, bytes: buf.length };
}

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
  const ext = name.split(".")[1];
  const mime = ext in TYPES ? TYPES[ext as Ext].mime : MEDIA[ext as MediaExt].mime;
  try {
    return { body: await readFile(path.join(uploadDir(), name)), mime };
  } catch {
    return null;
  }
}
