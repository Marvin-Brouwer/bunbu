import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { LineCounter, parseDocument, type Document } from "yaml";
import schemaV1 from "../../../schema/v1.json" with { type: "json" };
import { isGfmMarkdown } from "./markdown";
import { readSchemaReference } from "./modeline";
import type { BunbuData } from "./types";

export type ValidationIssue = {
  /** JSON pointer to the invalid value, such as `/questions/0/query`. Empty for the document itself. */
  path: string;
  message: string;
  /** 1-based line in the YAML file, when known. */
  line?: number;
};

/** Returned by {@link validate} when a quiz file is invalid. */
export class BunbuValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      issues.length === 1
        ? `Invalid quiz file: ${formatIssue(issues[0]!)}`
        : `Invalid quiz file, ${issues.length} issues:\n${issues.map((issue) => `- ${formatIssue(issue)}`).join("\n")}`,
    );
    this.name = "BunbuValidationError";
    this.issues = issues;
  }
}

const schemas: Record<number, object> = { 1: schemaV1 };
const validators = new Map<number, ValidateFunction>();

function getValidator(version: number): ValidateFunction | undefined {
  const schema = schemas[version];
  if (!schema) return undefined;

  let validator = validators.get(version);
  if (!validator) {
    const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: true, allowUnionTypes: true });
    addFormats(ajv, ["uri"]);
    ajv.addFormat("gfm", isGfmMarkdown);
    validator = ajv.compile(schema);
    validators.set(version, validator);
  }
  return validator;
}

/**
 * Parses and validates a quiz file against the schema version named in its first line.
 * Never rejects for invalid input: returns a {@link BunbuValidationError} instead.
 */
// `async` is part of the published API: a future schema version may load its validator on demand.
// oxlint-disable-next-line typescript/require-await
export async function validate(fileBlob: string): Promise<BunbuData | BunbuValidationError> {
  const issues: ValidationIssue[] = [];

  const reference = readSchemaReference(fileBlob);
  const schemaVersion = typeof reference === "string" ? undefined : reference.version;
  if (typeof reference === "string") issues.push({ path: "", message: reference, line: 1 });
  else if (!getValidator(reference.version)) {
    issues.push({ path: "", message: `Unknown schema version v${reference.version}`, line: 1 });
  }

  const lineCounter = new LineCounter();
  const document = parseDocument(fileBlob, { lineCounter });
  for (const error of document.errors) {
    issues.push({ path: "", message: error.message.split("\n")[0]!, line: error.linePos?.[0].line });
  }

  if (issues.length > 0 || schemaVersion === undefined) return new BunbuValidationError(issues);

  const data: unknown = document.toJS();
  const schemaIssues = checkData(data, schemaVersion, (pointer) => findLine(document, lineCounter, pointer));
  if (schemaIssues.length > 0) return new BunbuValidationError(schemaIssues);

  const quiz = data as BunbuData;
  // The schema types `version` as a string, but YAML parses an unquoted `version: 3` as a number.
  // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
  return { ...quiz, version: String(quiz.version) };
}

/** Checks parsed quiz data against a schema version. Returns no issues when the data is valid. */
export function checkData(
  data: unknown,
  schemaVersion: number,
  lineOf?: (pointer: string) => number | undefined,
): ValidationIssue[] {
  const validator = getValidator(schemaVersion);
  if (!validator) return [{ path: "", message: `Unknown schema version v${schemaVersion}` }];
  if (validator(data)) return [];

  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const error of validator.errors ?? []) {
    const issue: ValidationIssue = { path: error.instancePath, message: describe(error) };
    const line = lineOf?.(error.instancePath);
    if (line !== undefined) issue.line = line;
    const key = `${issue.path} ${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return issues;
}

function describe(error: ErrorObject): string {
  switch (error.keyword) {
    case "format":
      return error.params.format === "gfm"
        ? "must be GitHub-flavored Markdown without headings or raw HTML"
        : (error.message ?? "has an invalid format");
    case "additionalProperties":
    case "unevaluatedProperties": {
      const property = (error.params.additionalProperty ?? error.params.unevaluatedProperty) as string;
      return `must not have property '${property}'`;
    }
    case "contains":
      return "has the wrong number of options with `correct: true`";
    case "enum":
      return `must be one of: ${(error.params.allowedValues as unknown[]).join(", ")}`;
    default:
      return error.message ?? `failed '${error.keyword}'`;
  }
}

function findLine(document: Document, lineCounter: LineCounter, pointer: string): number | undefined {
  const path = pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
  const node = path.length === 0 ? document.contents : document.getIn(path, true);
  const offset = (node as { range?: [number, number, number] } | null)?.range?.[0];
  return offset === undefined ? undefined : lineCounter.linePos(offset).line;
}

function formatIssue(issue: ValidationIssue): string {
  const location = [issue.line && `line ${issue.line}`, issue.path].filter(Boolean).join(", ");
  return location ? `${issue.message} (${location})` : issue.message;
}
