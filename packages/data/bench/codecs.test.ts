import { brotliCompressSync, constants, zstdCompressSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { deflateSync } from "fflate";
import { compressSync as lzmaCompress } from "lzma-web/compress";
import { compress as zstdifyCompress } from "zstdify";
import { expect, it } from "vitest";
import { validate } from "../src";
import { pack } from "../src/share/pack";
import { generateLargeQuiz, toYamlFile } from "../test/fixtures/generate-large-quiz";

/*
 * Compares codecs for share links. Run with `pnpm bench` (not part of `pnpm test`).
 * Prints the share link length per codec, and how long each codec takes on the ~100 kB quiz.
 * Brotli and zstd from node:zlib are reference points only: they have no light browser build.
 */

const designDoc = readFileSync(new URL("../../../docs/design/data-format.md", import.meta.url), "utf8");
const docQuestions = [...designDoc.matchAll(/^(`{3,})yaml\n(- type:[\s\S]*?)^\1$/gm)].map((match) => match[2]!);
const docYaml = `# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json
id: doc
title: Doc examples
version: 1
language: en
passingScore: 70
questions:
${docQuestions.join("").replace(/^(?=.)/gm, "  ")}`;

const docData = await validate(docYaml);
if (docData instanceof Error) throw docData;

const corpus = {
  "doc examples": docData,
  "large (~100 kB)": generateLargeQuiz(250, 1),
  "large (~500 kB)": generateLargeQuiz(1250, 2),
};

const encoder = new TextEncoder();
const base64urlLength = (bytes: number): number => Math.ceil((bytes * 4) / 3);

async function nativeDeflate(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const codecs: Record<string, (input: Uint8Array) => Uint8Array | Promise<Uint8Array>> = {
  "native deflate-raw": nativeDeflate,
  "fflate 9/12": (input) => deflateSync(input, { level: 9, mem: 12 }),
  "lzma-web 9": (input) => lzmaCompress(input, 9),
  "zstdify 9": (input) => zstdifyCompress(input, { level: 9 }),
  "(ref) brotli 11": (input) =>
    brotliCompressSync(input, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24 } }),
  "(ref) zstd 19": (input) => zstdCompressSync(input, { params: { [constants.ZSTD_c_compressionLevel]: 19 } }),
};

it("compares codecs", { timeout: 600_000 }, async () => {
  const sizes: Record<string, Record<string, number>> = {};
  for (const [name, data] of Object.entries(corpus)) {
    const inputs = { yaml: encoder.encode(toYamlFile(data)), packed: pack(data) };
    for (const [input, bytes] of Object.entries(inputs)) {
      const row: Record<string, number> = { "input bytes": bytes.length };
      for (const [codec, compress] of Object.entries(codecs)) {
        row[codec] = base64urlLength((await compress(bytes)).length);
      }
      sizes[`${name} / ${input}`] = row;
    }
  }
  console.log("Share link length (base64url characters):");
  console.table(sizes);

  const packed = pack(corpus["large (~100 kB)"]);
  const timings: Record<string, string> = {};
  for (const [codec, compress] of Object.entries(codecs)) {
    const start = performance.now();
    await compress(packed);
    timings[codec] = `${Math.round(performance.now() - start)} ms`;
  }
  console.log("Compression time for the packed ~100 kB quiz:");
  console.table(timings);

  expect(Object.keys(sizes)).toHaveLength(6);
});
