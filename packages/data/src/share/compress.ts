import type { BunbuData } from "../types";
import { BunbuValidationError, checkData } from "../validate";
import { compressBytes, decompressBytes, fromBase64Url, toBase64Url } from "./codec";
import { pack, unpack } from "./pack";

/*
 * Share format v1, marked by the leading "A": schema v1, packed by pack.ts, compressed by codec.ts,
 * base64url-encoded. Packing and codec settings are frozen per share version: a change gets a new
 * letter, and uncompress keeps decoding the older ones.
 */
const shareVersion = "A";
const schemaVersion = 1;

/**
 * Compresses a quiz into a short, URL-safe string (`A-Z a-z 0-9 - _`), for example to put in a
 * link's fragment. Rejects with a {@link BunbuValidationError} when the data isn't a valid quiz.
 */
export async function compress(data: BunbuData): Promise<string> {
  const issues = checkData(data, schemaVersion);
  if (issues.length > 0) throw new BunbuValidationError(issues);
  return shareVersion + toBase64Url(await compressBytes(pack(data)));
}

/**
 * Restores a quiz from {@link compress}. Rejects with an `Error` for corrupt or unknown data, and
 * with a {@link BunbuValidationError} when the restored quiz isn't valid: shared links are untrusted.
 */
export async function uncompress(data: string): Promise<BunbuData> {
  if (data[0] !== shareVersion) throw new Error("Unknown share format");
  const quiz = unpack(await decompressBytes(fromBase64Url(data.slice(1))));
  const issues = checkData(quiz, schemaVersion);
  if (issues.length > 0) throw new BunbuValidationError(issues);
  return quiz;
}
