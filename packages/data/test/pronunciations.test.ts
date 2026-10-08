import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  compress,
  defaultPronunciations,
  pronunciationDictionaries,
  resolvePronunciations,
  uncompress,
  type BunbuData,
} from "../src";
import builtInV1 from "../pronunciations/v1.g.json" with { type: "json" };
import releases from "../pronunciations/releases.json" with { type: "json" };

function quiz(pronunciations?: Record<string, string>, language = "en"): BunbuData {
  return {
    id: "pronunciations",
    title: "Pronunciations",
    version: "1",
    language,
    passingScore: 70,
    ...(pronunciations ? { pronunciations } : {}),
    questions: [{ type: "yes-no", query: "Is SQL a query language?" as never, answer: "yes" }],
  };
}

describe("built-in pronunciation dictionaries", () => {
  it("are flat maps of non-empty strings, with every term in exactly one dictionary", () => {
    const seen = new Map<string, string>();
    for (const [name, dictionary] of Object.entries(pronunciationDictionaries)) {
      for (const [term, spoken] of Object.entries(dictionary)) {
        expect(typeof spoken, `${name}: ${term}`).toBe("string");
        expect(term.trim(), `${name}: empty term`).not.toBe("");
        expect(spoken.trim(), `${name}: ${term}`).not.toBe("");
        expect(seen.get(term), `${term} is in both ${seen.get(term)} and ${name}`).toBeUndefined();
        seen.set(term, name);
      }
    }
    expect(Object.keys(defaultPronunciations())).toHaveLength(seen.size);
  });

  it("apply to every quiz, whatever its language", () => {
    expect(resolvePronunciations(quiz(undefined, "nl"))).toEqual(defaultPronunciations());
    expect(resolvePronunciations(quiz(undefined, "en-US"))).toEqual(defaultPronunciations());
  });

  it("are overridden by a quiz's own entries, and keep quiz-only entries", () => {
    const resolved = resolvePronunciations(quiz({ SQL: "S Q L", AKS: "A K S" }));
    expect(resolved.SQL).toBe("S Q L");
    expect(resolved.AKS).toBe("A K S");
    expect(resolved.Redis).toBe(defaultPronunciations().Redis);
  });

  it("are compiled into pronunciations/v1.g.json, which is frozen once released", () => {
    const hash = createHash("sha256").update(JSON.stringify(builtInV1)).digest("hex");
    const releasedHash = (releases.released as Record<string, string>)["1"];
    if (releasedHash !== undefined) {
      expect(hash, "pronunciations/v1.g.json is released and must never change").toBe(releasedHash);
    } else {
      // Unreleased: the compiled file must follow the dictionaries. Run `pnpm build` after editing them.
      expect(builtInV1, `run pnpm build to recompile (current sha256 ${hash})`).toEqual(defaultPronunciations());
    }
  });
});

describe(".bunbu files and built-in pronunciations", () => {
  it("leave out entries that equal the built-in ones", async () => {
    const builtInOnly = await compress(quiz({ SQL: builtInV1.SQL, Redis: builtInV1.Redis }));
    const none = await compress(quiz());
    expect(builtInOnly.length).toBe(none.length);
  });

  it("keep overrides and quiz-only entries", async () => {
    const result = await uncompress(await compress(quiz({ SQL: "S Q L", AKS: "A K S" })));
    expect(result.pronunciations).toEqual({ ...builtInV1, SQL: "S Q L", AKS: "A K S" });
  });

  it("restore the built-in entries the file was compressed against", async () => {
    const result = await uncompress(await compress(quiz()));
    expect(result.pronunciations).toEqual(builtInV1);
  });
});
