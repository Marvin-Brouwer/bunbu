import { compressAsync } from "lzma-web/compress";
import { decompressAsync } from "lzma-web/decompress";
import { BunbuShareError } from "./errors";

/*
 * LZMA, chosen by `pnpm bench` (bench/codecs.test.ts). Compressed size of a packed quiz, in bytes:
 *
 *   YAML      deflate   fflate 9   zstdify 9   lzma 6    (brotli 11, zstd 19: no light browser build)
 *   ~5 kB       1608       1637        1721     1674     1244, 1632
 *   ~230 kB    30486      30546       48782    26193    26088, 26327
 *   ~1.1 MB   139908     140678      223757   109461    110804, 109916
 *
 * Level 6 compresses as well as level 9 on these quizzes, in ~0.5 s instead of ~3.4 s for the
 * ~230 kB quiz, and its 4 MB window still covers multi-megabyte quizzes.
 */
const level = 6;

// LZMA header written by lzma-web: properties (lc=3, lp=0, pb=2), dictionary size, uncompressed size.
const properties = 0x5d;
const dictionarySize = 1 << 22;
const headerLength = 13;

// Upper bound for packed quizzes (about 25 MB of YAML). Files are untrusted, and the decoder
// would otherwise allocate whatever size a file claims.
const maxSize = 16 * 1024 * 1024;

/*
 * The .bunbu container (share v1):
 *   "BUNBU" + NUL byte + version byte (1)
 *   varint(packed size) + varint(LZMA body length) + CRC-32 of the packed bytes (4 bytes, LE)
 *   LZMA body: lzma-web's output without its 13-byte header (fixed for v1) and without the
 *   range coder's first byte (always 0)
 * The body length tells a cut-off file ("incomplete") from a damaged one; the CRC catches
 * damage that would otherwise decode into subtly different text.
 */
// "BUNBU" + NUL: the NUL makes editors and other tools recognise the file as binary.
const signature = [0x42, 0x55, 0x4e, 0x42, 0x55, 0x00];
const formatVersion = 1;
const prefixLength = signature.length + 1;

export async function compressBytes(input: Uint8Array): Promise<Uint8Array> {
  const lzma = await compressAsync(input, level);
  if (lzma[headerLength] !== 0) throw new Error("Unexpected LZMA output");
  const body = lzma.subarray(headerLength + 1);

  const head = [...signature, formatVersion, ...varint(input.length), ...varint(body.length)];
  const output = new Uint8Array(head.length + 4 + body.length);
  output.set(head, 0);
  new DataView(output.buffer).setUint32(head.length, crc32(input), true);
  output.set(body, head.length + 4);
  return output;
}

export async function decompressBytes(input: Uint8Array): Promise<Uint8Array> {
  if (input.length < prefixLength) {
    const isStartOfSignature = [...input].every((byte, index) => byte === [...signature, formatVersion][index]);
    throw new BunbuShareError(isStartOfSignature && input.length > 0 ? "incomplete" : "unknown-format");
  }
  if (signature.some((byte, index) => input[index] !== byte) || input[signature.length] !== formatVersion) {
    throw new BunbuShareError("unknown-format");
  }

  const size = readVarint(input, prefixLength);
  const bodyLength = readVarint(input, size.end);
  const bodyStart = bodyLength.end + 4;
  // Packed data is never empty, and lzma-web stalls for seconds on a declared size of 0.
  if (size.value === 0 || size.value > maxSize) throw new BunbuShareError("corrupt");
  if (input.length < bodyStart + bodyLength.value) throw new BunbuShareError("incomplete");
  if (input.length > bodyStart + bodyLength.value) throw new BunbuShareError("corrupt");
  const checksum = new DataView(input.buffer, input.byteOffset).getUint32(bodyLength.end, true);

  const lzma = new Uint8Array(headerLength + 1 + bodyLength.value);
  const view = new DataView(lzma.buffer);
  view.setUint8(0, properties);
  view.setUint32(1, dictionarySize, true);
  view.setBigUint64(5, BigInt(size.value), true);
  lzma.set(input.subarray(bodyStart), headerLength + 1);

  let output: string | Uint8Array;
  try {
    output = await decompressAsync(lzma);
  } catch {
    throw new BunbuShareError("corrupt");
  }
  // lzma-web returns a string when the output happens to be valid UTF-8.
  const bytes = typeof output === "string" ? new TextEncoder().encode(output) : output;
  if (bytes.length !== size.value || crc32(bytes) !== checksum) throw new BunbuShareError("corrupt");
  return bytes;
}

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
  return bytes;
}

function readVarint(bytes: Uint8Array, start: number): { value: number; end: number } {
  let value = 0;
  for (let index = start, shift = 1; index < start + 8; index++, shift *= 0x80) {
    const byte = bytes[index];
    // Running out of bytes inside the header means the code was cut off.
    if (byte === undefined) throw new BunbuShareError("incomplete");
    value += (byte & 0x7f) * shift;
    if (byte < 0x80) return { value, end: index + 1 };
  }
  throw new BunbuShareError("corrupt");
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
