import type { BunbuData } from "../types";
import { BunbuValidationError, checkData } from "../validate";
import { compressBytes, decompressBytes } from "./codec";
import { pack, unpack } from "./pack";

/*
 * A quiz is shared as a `.bunbu` file: schema v1, packed by pack.ts, compressed and sealed by
 * codec.ts. The container starts with "BUNBU" and a version byte; packing and codec settings are
 * frozen per version, a change gets a new version, and uncompress keeps reading the older ones.
 */
const schemaVersion = 1;

/** File extension for a compressed quiz. */
export const fileExtension = ".bunbu";
/** Media type for `.bunbu` files. */
export const mimeType = "application/vnd.bunbu";

/**
 * Compresses a quiz into the contents of a `.bunbu` file.
 * Rejects with a {@link BunbuValidationError} when the data isn't a valid quiz.
 */
export async function compress(data: BunbuData): Promise<Uint8Array> {
  const issues = checkData(data, schemaVersion);
  if (issues.length > 0) throw new BunbuValidationError(issues);
  return compressBytes(pack(data));
}

/**
 * Restores a quiz from a `.bunbu` file, given as a `File`/`Blob` or as bytes.
 * Rejects with a {@link BunbuShareError} when the file can't be read as a quiz, and with a
 * {@link BunbuValidationError} when the restored quiz isn't valid: shared files are untrusted.
 */
export async function uncompress(file: Blob | ArrayBuffer | Uint8Array): Promise<BunbuData> {
  const bytes =
    file instanceof Uint8Array ? file : new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  const quiz = unpack(await decompressBytes(bytes));
  const issues = checkData(quiz, schemaVersion);
  if (issues.length > 0) throw new BunbuValidationError(issues);
  return quiz;
}
