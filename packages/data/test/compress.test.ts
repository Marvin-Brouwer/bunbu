import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BunbuValidationError, compress, uncompress, validate, type BunbuData } from "../src";
import { generateLargeQuiz } from "./fixtures/generate-large-quiz";

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

async function docExamples(): Promise<BunbuData> {
  const data = await validate(docYaml);
  if (data instanceof Error) throw data;
  return data;
}

const smallQuiz: BunbuData = {
  id: "small",
  title: "Small",
  version: "2",
  language: "nl-NL",
  passingScore: 62.5,
  authors: ["Ada", "Grace"],
  license: "CC-BY-4.0",
  description: "Een **kleine** quiz met één vraag — en emoji 🎉" as BunbuData["description"],
  // fromEntries, because a literal __proto__ key would set the prototype instead.
  pronunciations: Object.fromEntries([["__proto__", "proto"], ["SQL", "sequel"]]),
  questions: [
    {
      type: "match",
      query: "Match" as never,
      rows: [
        { text: "a" as never, answer: "same" as never },
        { text: "b" as never, answer: "same" as never },
        {
          text: "c" as never,
          options: [
            { answer: "x" as never, correct: false, explanation: "no" as never },
            { answer: "same" as never, correct: true },
          ],
        },
      ],
      distractors: [],
      references: [{ "Docs: x": "https://example.com/x" }],
    },
    { type: "yes-no", query: "Yes?" as never, answer: "no" },
    {
      type: "multiple",
      query: "Pick" as never,
      scoring: "all",
      options: Array.from({ length: 10 }, (_, index) => ({ answer: `o${index}` as never, correct: index % 3 === 0 })),
    },
  ],
};

describe("compress / uncompress", () => {
  it("round-trips every question example from the design doc", async () => {
    const data = await docExamples();
    expect(await uncompress(await compress(data))).toEqual(data);
  });

  it("round-trips optional fields, unicode, repeated strings and a fractional score", async () => {
    const restored = await uncompress(await compress(smallQuiz));
    expect(restored).toEqual(smallQuiz);
    expect(Object.keys(restored.pronunciations!)).toEqual(["__proto__", "SQL"]);
    expect(Object.getPrototypeOf(restored.pronunciations)).toBe(Object.prototype);
    expect("scoring" in restored.questions[1]!).toBe(false);
  });

  it("round-trips a large generated quiz", { timeout: 60_000 }, async () => {
    const data = generateLargeQuiz(250, 1);
    expect(await uncompress(await compress(data))).toEqual(data);
  });

  it("produces a URL-safe string with the share version first", async () => {
    const shared = await compress(await docExamples());
    expect(shared).toMatch(/^A[A-Za-z0-9_-]+$/);
  });

  it("keeps share links small", { timeout: 60_000 }, async () => {
    // Regression guards, a few percent above the sizes measured when share v1 was introduced.
    expect((await compress(await docExamples())).length).toBeLessThan(2400);
    expect((await compress(generateLargeQuiz(250, 1))).length).toBeLessThan(36_500);
  });

  it("rejects invalid data", async () => {
    const data = await docExamples();
    const single = data.questions.find((question) => question.type === "single")!;
    const invalid = { ...data, questions: [{ ...single, options: single.options.map((option) => ({ ...option, correct: true })) }] };
    await expect(compress(invalid)).rejects.toBeInstanceOf(BunbuValidationError);
  });

  it.each([
    ["an empty string", ""],
    ["an unknown share version", "Zabc"],
    ["characters outside base64url", "A$$$$"],
    ["garbage", "AAAAAAAAAAAAAAAAAAAA"],
    ["a size claim far beyond the limit", "A_____AAAAAAAAAAAAAA"],
  ])("rejects %s", async (_, input) => {
    await expect(uncompress(input)).rejects.toThrow();
  });

  it("rejects truncated and altered data", async () => {
    const shared = await compress(await docExamples());
    await expect(uncompress(shared.slice(0, -10))).rejects.toThrow();
    const altered = shared.slice(0, 40) + (shared[40] === "B" ? "C" : "B") + shared.slice(41);
    await expect(uncompress(altered)).rejects.toThrow();
  });
});
