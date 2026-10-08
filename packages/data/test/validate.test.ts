import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BunbuValidationError, validate, type BunbuData } from "../src";

const modeline = "# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json";
const designDoc = readFileSync(new URL("../../../docs/design/data-format.md", import.meta.url), "utf8");
const yamlBlocks = [...designDoc.matchAll(/^(`{3,})yaml\n([\s\S]*?)^\1$/gm)].map((match) => match[2]!);

function quiz(questions: string): string {
  return `${modeline}\n\nid: test\ntitle: Test\nversion: 1\nlanguage: en\npassingScore: 70\nquestions:\n${questions}`;
}

function indent(text: string): string {
  return text.replace(/^(?=.)/gm, "  ");
}

async function expectValid(text: string): Promise<BunbuData> {
  const result = await validate(text);
  if (result instanceof Error) throw result;
  return result;
}

async function expectIssues(text: string): Promise<BunbuValidationError> {
  const result = await validate(text);
  expect(result).toBeInstanceOf(BunbuValidationError);
  return result as BunbuValidationError;
}

const single = `
  - type: single
    query: >-
      Which is a query language?
    options:
      - correct: true
        answer: SQL
      - correct: false
        answer: HTML
`;

describe("validate", () => {
  it("accepts the full example from the design doc", async () => {
    const fullExample = yamlBlocks.find((block) => block.startsWith("# yaml-language-server") && block.includes("questions:"));
    expect(fullExample).toBeDefined();

    const data = await expectValid(fullExample!);
    expect(data.id).toBe("example");
    expect(data.version).toBe("1");
    expect(data.questions[1]!.type).toBe("single");
  });

  it("accepts every question example from the design doc", async () => {
    const questions = yamlBlocks.filter((block) => block.startsWith("- type:"));
    expect(questions.length).toBeGreaterThanOrEqual(6);

    const data = await expectValid(quiz(indent(questions.join(""))));
    expect(new Set(data.questions.map((question) => question.type))).toEqual(
      new Set(["yes-no", "single", "multiple", "order", "match", "solutions"]),
    );
  });

  it("normalizes a numeric version to a string", async () => {
    const data = await expectValid(quiz(single));
    expect(data.version).toBe("1");
  });

  it("requires the schema modeline", async () => {
    const error = await expectIssues(quiz(single).replace(modeline, "# just a comment"));
    expect(error.issues).toEqual([expect.objectContaining({ line: 1, message: expect.stringContaining("first line") })]);
  });

  it("rejects an unknown schema version", async () => {
    const error = await expectIssues(quiz(single).replace("/v1.json", "/v99.json"));
    expect(error.issues[0]!.message).toBe("Unknown schema version v99");
  });

  it("reports YAML syntax errors with a line number", async () => {
    const error = await expectIssues(`${modeline}\nid: test\ntitle: [unclosed\n`);
    expect(error.issues[0]!.line).toBeGreaterThan(1);
  });

  it("rejects a single question with two correct options", async () => {
    const error = await expectIssues(quiz(single.replace("correct: false", "correct: true")));
    expect(error.issues).toContainEqual(expect.objectContaining({ path: "/questions/0/options" }));
  });

  it("rejects an invalid yes-no answer", async () => {
    const error = await expectIssues(quiz("  - type: yes-no\n    query: Is it?\n    answer: maybe\n"));
    expect(error.issues).toContainEqual(
      expect.objectContaining({ path: "/questions/0/answer", message: "must be one of: yes, no" }),
    );
  });

  it("rejects an unknown question type", async () => {
    const error = await expectIssues(quiz("  - type: essay\n    query: Write something\n"));
    expect(error.issues[0]!.path).toBe("/questions/0/type");
  });

  it("requires source to be text: url entries, not Markdown", async () => {
    const withSource = (source: string) => quiz(single.replace("    options:", `    source:${source}\n    options:`));
    await expectValid(withSource("\n      - Origin: https://example.com/origin"));
    const error = await expectIssues(withSource(" >-\n      [Origin](https://example.com/origin)"));
    expect(error.issues).toContainEqual(expect.objectContaining({ path: "/questions/0/source", message: "must be array" }));
  });

  it("rejects unknown properties", async () => {
    const error = await expectIssues(`${quiz(single)}tags: [a]\n`);
    expect(error.issues).toContainEqual(expect.objectContaining({ path: "", message: "must not have property 'tags'" }));
  });

  it("rejects headings and HTML in Markdown fields, pointing at the line", async () => {
    const text = quiz(single.replace("answer: HTML", "answer: |-\n          ## Heading"));
    const error = await expectIssues(text);
    const issue = error.issues.find((candidate) => candidate.path === "/questions/0/options/1/answer");
    expect(issue?.message).toContain("Markdown");
    expect(text.split("\n")[issue!.line! - 1]).toContain("answer:");
  });

  it("returns errors with a readable message", async () => {
    const error = await expectIssues(quiz("  - type: yes-no\n    answer: yes\n"));
    expect(error.message).toContain("must have required property 'query'");
  });
});
