import { compressAsync } from "lzma-web/compress";
import { decompressAsync } from "lzma-web/decompress";

/*
 * LZMA, chosen by `pnpm bench` (bench/codecs.test.ts). Share link length for a packed quiz:
 *
 *   quiz      deflate   fflate 9   zstdify 9   lzma 6    (brotli 11, zstd 19: no light browser build)
 *   ~5 kB       2144       2183        2295     2232     1658, 2176
 *   ~230 kB    40648      40728       65042    34924    34784, 35102
 *   ~1.1 MB   186544     187571      298343   145948    147738, 146555
 *
 * Level 6 compresses as well as level 9 on these quizzes, in ~0.5 s instead of ~3.4 s for the
 * ~230 kB quiz, and its 4 MB window still covers multi-megabyte quizzes.
 */
const level = 6;

// LZMA header written by lzma-web: properties (lc=3, lp=0, pb=2), dictionary size, uncompressed size.
const properties = 0x5d;
const dictionarySize = 1 << 22;
const headerLength = 13;

// Upper bound for packed quizzes (about 25 MB of YAML). Links are untrusted, and the decoder
// would otherwise allocate whatever size a link claims.
const maxSize = 16 * 1024 * 1024;

/** LZMA without its 13-byte header: the header is fixed for share v1, except the size (a varint). */
export async function compressBytes(input: Uint8Array): Promise<Uint8Array> {
  const compressed = await compressAsync(input, level);
  const size = varint(input.length);
  const output = new Uint8Array(size.length + compressed.length - headerLength);
  output.set(size, 0);
  output.set(compressed.subarray(headerLength), size.length);
  return output;
}

export async function decompressBytes(input: Uint8Array): Promise<Uint8Array> {
  const { value: size, length } = readVarint(input);
  // Packed data is never empty, and lzma-web stalls for seconds on a declared size of 0.
  if (size === 0 || size > maxSize) throw new Error("Corrupt share data");
  const header = new Uint8Array(headerLength);
  const view = new DataView(header.buffer);
  view.setUint8(0, properties);
  view.setUint32(1, dictionarySize, true);
  view.setBigUint64(5, BigInt(size), true);

  const lzma = new Uint8Array(headerLength + input.length - length);
  lzma.set(header, 0);
  lzma.set(input.subarray(length), headerLength);

  let output: string | Uint8Array;
  try {
    output = await decompressAsync(lzma);
  } catch {
    throw new Error("Corrupt share data");
  }
  // lzma-web returns a string when the output happens to be valid UTF-8.
  const bytes = typeof output === "string" ? new TextEncoder().encode(output) : output;
  if (bytes.length !== size) throw new Error("Corrupt share data");
  return bytes;
}

function varint(value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
  return Uint8Array.from(bytes);
}

function readVarint(bytes: Uint8Array): { value: number; length: number } {
  let value = 0;
  for (let index = 0, shift = 1; index < 8; index++, shift *= 0x80) {
    const byte = bytes[index];
    if (byte === undefined) break;
    value += (byte & 0x7f) * shift;
    if (byte < 0x80) return { value, length: index + 1 };
  }
  throw new Error("Corrupt share data");
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const lookup = new Map([...alphabet].map((character, index) => [character, index]));

/** base64url without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index]! << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    const characters = Math.min(4, Math.ceil(((bytes.length - index) * 4) / 3));
    for (let position = 0; position < characters; position++) {
      output += alphabet[(chunk >> (18 - position * 6)) & 0x3f];
    }
  }
  return output;
}

export function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error("Corrupt share data");
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let byteIndex = 0;
  for (let index = 0; index < text.length; index += 4) {
    let chunk = 0;
    for (let position = 0; position < 4; position++) {
      const character = text[index + position];
      const value = character === undefined ? 0 : lookup.get(character);
      if (value === undefined) throw new Error("Corrupt share data");
      chunk |= value << (18 - position * 6);
    }
    for (let shift = 16; shift >= 0 && byteIndex < bytes.length; shift -= 8) {
      bytes[byteIndex++] = (chunk >> shift) & 0xff;
    }
  }
  return bytes;
}
