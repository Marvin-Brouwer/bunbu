import { describe, expect, it } from "vitest";
import { isGfmMarkdown } from "../src/markdown";

describe("isGfmMarkdown", () => {
  it.each([
    ["plain text", "Which attribute provides a text alternative?"],
    ["emphasis and inline code", "Use **empty** `alt=\"\"` for *decorative* images."],
    ["inline code containing a tag", "`<table>` markup"],
    ["code block containing a comment", "Run this:\n\n```sh\n# install\npnpm i\n```"],
    ["code block containing HTML", "```html\n<img src=\"chart.png\">\n```"],
    ["list", "- one\n- two"],
    ["ordered list", "1. one\n2. two"],
    ["table", "| a | b |\n| - | - |\n| 1 | 2 |"],
    ["image", "![Box model](https://example.com/box.svg)"],
    ["autolink", "<https://example.com>"],
    ["hash inside a sentence", "Use C# or F#"],
    ["escaped angle brackets", "kubectl logs \\<pod> --previous"],
    ["escaped heading marker", "\\# not a heading"],
  ])("accepts %s", (_, value) => {
    expect(isGfmMarkdown(value)).toBe(true);
  });

  it.each([
    ["ATX heading", "## Heading"],
    ["ATX heading after text", "Intro\n\n# Title"],
    ["setext heading", "Title\n====="],
    ["setext h2", "Title\n---"],
    ["HTML tag", "Hello <div>world</div>"],
    ["self-closing HTML tag", "Line<br/>break"],
  ])("rejects %s", (_, value) => {
    expect(isGfmMarkdown(value)).toBe(false);
  });
});
