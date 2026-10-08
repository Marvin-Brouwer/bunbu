import type { BunbuData } from "../types";
import { BunbuValidationError, checkData } from "../validate";
import { compressBytes, decompressBytes } from "./codec";
import { pack, unpack } from "./pack";
import builtInPronunciationsV1 from "../../pronunciations/v1.g.json" with { type: "json" };

/*
 * A quiz is shared as a `.bunbu` file: schema v1, packed by pack.ts, compressed and sealed by
 * codec.ts. The container starts with "BUNBU" and a version byte; packing and codec settings are
 * frozen per version, a change gets a new version, and uncompress keeps reading the older ones.
 */
const schemaVersion = 1;

/*
 * Entries that equal the built-in pronunciations are left out of the file and restored on reading.
 * Format v1 uses pronunciations/v1.g.json, compiled from the built-in dictionaries and frozen once
 * released, so an old file always gets back exactly the entries it was compressed against.
 */
const builtIn: Readonly<Record<string, string>> = builtInPronunciationsV1;

function withoutBuiltInPronunciations(data: BunbuData): BunbuData {
  if (data.pronunciations === undefined) return data;
  const { pronunciations, ...rest } = data;
  const own = Object.entries(pronunciations).filter(([term, spoken]) => builtIn[term] !== spoken);
  return own.length > 0 ? { ...rest, pronunciations: Object.fromEntries(own) } : rest;
}

function withBuiltInPronunciations(data: BunbuData): BunbuData {
  return { ...data, pronunciations: { ...builtIn, ...data.pronunciations } };
}

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
  return compressBytes(pack(withoutBuiltInPronunciations(data)));
}

/**
 * Restores a quiz from a `.bunbu` file, given as a `File`/`Blob` or as bytes. Its `pronunciations`
 * include the built-in entries the file was compressed against.
 * Rejects with a {@link BunbuShareError} when the file can't be read as a quiz, and with a
 * {@link BunbuValidationError} when the restored quiz isn't valid: shared files are untrusted.
 */
export async function uncompress(file: Blob | ArrayBuffer | Uint8Array): Promise<BunbuData> {
  const bytes =
    file instanceof Uint8Array ? file : new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  const quiz = withBuiltInPronunciations(unpack(await decompressBytes(bytes)));
  const issues = checkData(quiz, schemaVersion);
  if (issues.length > 0) throw new BunbuValidationError(issues);
  return quiz;
}
