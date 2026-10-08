import { stringify } from "yaml";
import type { BunbuData, MatchRow, Option, Question } from "../../src";

/*
 * Deterministic generator for large, varied quizzes, used to benchmark and test sharing.
 * The prose is built from templates and a vocabulary, so it repeats about as much as
 * real technical writing does, not like copy-pasted questions would.
 */

const nouns = [
  "cache", "queue", "request", "response", "header", "token", "session", "cookie", "index", "table",
  "column", "row", "query", "schema", "endpoint", "service", "container", "image", "volume", "network",
  "proxy", "load balancer", "certificate", "key", "secret", "role", "policy", "user", "group", "tenant",
  "region", "replica", "partition", "shard", "transaction", "lock", "thread", "process", "worker", "job",
  "event", "message", "topic", "subscription", "stream", "buffer", "file", "directory", "branch", "commit",
  "build", "pipeline", "deployment", "release", "rollback", "test", "assertion", "mock", "fixture", "log",
  "metric", "trace", "span", "alert", "dashboard", "function", "closure", "promise", "callback", "module",
  "package", "dependency", "selector", "element", "attribute", "component", "layout", "breakpoint", "font", "color",
];
const verbs = [
  "stores", "returns", "rejects", "caches", "validates", "encrypts", "compresses", "retries", "logs", "routes",
  "signs", "parses", "serializes", "indexes", "locks", "replicates", "scales", "deploys", "monitors", "renders",
  "invalidates", "expires", "queues", "publishes", "consumes", "authenticates", "authorizes", "throttles", "migrates", "rebuilds",
];
const adjectives = [
  "stale", "idempotent", "immutable", "distributed", "encrypted", "expired", "cached", "partitioned", "versioned", "signed",
  "read-only", "transient", "durable", "nested", "optional", "required", "default", "custom", "external", "internal",
];
const identifiers = [
  "maxRetries", "timeoutMs", "cacheControl", "userId", "orderId", "isEnabled", "retryAfter", "batchSize",
  "connectionString", "region", "replicaCount", "ttl", "etag", "apiVersion", "pageSize", "cursor",
];

type Random = () => number;

function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generator(random: Random) {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const chance = (probability: number): boolean => random() < probability;
  const code = (): string => `\`${pick(identifiers)}\``;
  const phrase = (): string => `${chance(0.5) ? "the" : "a"} ${chance(0.4) ? `${pick(adjectives)} ` : ""}${pick(nouns)}`;

  const sentence = (): string => {
    const templates = [
      () => `A ${pick(nouns)} ${pick(verbs)} ${phrase()} when ${code()} is set.`,
      () => `The team notices that ${phrase()} ${pick(verbs)} ${phrase()} more often than expected.`,
      () => `Each ${pick(nouns)} must be **${pick(adjectives)}** before it ${pick(verbs)} ${phrase()}.`,
      () => `You configure ${code()} so that ${phrase()} ${pick(verbs)} ${phrase()}.`,
      () => `After a restart, ${phrase()} no longer ${pick(verbs)} ${phrase()}.`,
      () => `Requests to the ${pick(nouns)} fail with a timeout once ${code()} exceeds ${Math.floor(random() * 900) + 100}.`,
    ];
    return pick(templates)();
  };

  const paragraph = (count: number): string => Array.from({ length: count }, sentence).join(" ");

  const codeBlock = (): string => {
    const count = 2 + Math.floor(random() * 3);
    const lines = Array.from({ length: count }, (_, index) => {
      const value = chance(0.5) ? Math.floor(random() * 1000) : `"${pick(nouns)}"`;
      return `  "${pick(identifiers)}": ${value}${index < count - 1 ? "," : ""}`;
    });
    return ["```json", "{", ...lines, "}", "```"].join("\n");
  };

  const query = (): string => {
    const parts = [paragraph(1 + Math.floor(random() * 3))];
    if (chance(0.25)) parts.push(codeBlock());
    if (chance(0.3)) parts.push(`Requirements:\n\n${Array.from({ length: 2 + Math.floor(random() * 2) }, () => `- ${sentence()}`).join("\n")}`);
    parts.push(`Which ${pick(["action", "setting", "approach", "change"])} should you ${pick(["take", "use", "apply", "recommend"])}?`);
    return parts.join("\n\n");
  };

  const answer = (): string =>
    chance(0.3)
      ? `Set ${code()} on ${phrase()}`
      : `${pick(["Configure", "Enable", "Disable", "Replace", "Move", "Encrypt", "Cache"])} ${phrase()} ${chance(0.5) ? `so it ${pick(verbs)} ${phrase()}` : `per ${pick(nouns)}`}`;

  const options = (count: number, correct: number): Option[] =>
    Array.from({ length: count }, (_, index) => {
      const option: Option = { answer: answer() as Option["answer"], correct: index < correct };
      if (chance(0.3)) option.explanation = paragraph(1) as Option["explanation"];
      return option;
    }).sort(() => random() - 0.5);

  const question = (): Question => {
    const base = { query: query() as Question["query"] };
    const extras = (target: Question): Question => {
      if (chance(0.7)) target.explanation = paragraph(1 + Math.floor(random() * 2)) as Question["explanation"];
      if (chance(0.2)) target.source = `Written for the ${pick(nouns)} module` as Question["source"];
      if (chance(0.4)) target.references = [{ [`Docs: ${pick(nouns)}`]: `https://example.com/docs/${pick(nouns).replace(/ /g, "-")}` }];
      return target;
    };
    const kind = Math.floor(random() * 6);
    switch (kind) {
      case 0:
        return extras({ type: "yes-no", ...base, answer: chance(0.5) ? "yes" : "no" });
      case 1:
        return extras({ type: "single", ...base, options: options(4, 1) });
      case 2:
        return extras({ type: "multiple", ...base, options: options(5, 2), ...(chance(0.5) ? { scoring: "partial" as const } : {}) });
      case 3:
        return extras({ type: "order", ...base, options: options(4, 4).map((option) => ({ ...option, correct: true })) });
      case 4: {
        const pool = Array.from({ length: 4 }, () => answer());
        const rows: MatchRow[] = Array.from({ length: 3 + Math.floor(random() * 2) }, () =>
          chance(0.7)
            ? { text: sentence() as MatchRow["text"], answer: pick(pool) as MatchRow["text"] }
            : { text: sentence() as MatchRow["text"], options: options(3, 1) },
        );
        return extras({ type: "match", ...base, rows, ...(chance(0.5) ? { distractors: [answer() as MatchRow["text"]] } : {}) });
      }
      default:
        return extras({ type: "solutions", ...base, scenario: paragraph(3) as Question["query"], options: options(3, 1) });
    }
  };

  return { question, paragraph };
}

/** A valid quiz with the given number of questions; the same seed always gives the same quiz. */
export function generateLargeQuiz(questionCount: number, seed = 1): BunbuData {
  const { question, paragraph } = generator(seeded(seed));
  return {
    id: "generated",
    title: "Generated quiz",
    version: "1",
    language: "en",
    description: paragraph(2) as BunbuData["description"],
    passingScore: 70,
    pronunciations: { SQL: "sequel", nginx: "engine x" },
    questions: Array.from({ length: questionCount }, question),
  };
}

const modeline = "# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json";

/** The quiz as a YAML file, as an author would write it. */
export function toYamlFile(data: BunbuData): string {
  return `${modeline}\n\n${stringify(data, { blockQuote: "folded", lineWidth: 0 })}`;
}
