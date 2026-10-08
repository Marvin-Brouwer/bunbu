import type { BunbuData, MatchRow, Option, Question, QuestionType, Reference } from "../types";
import type { Markdown } from "../markdown";

/*
 * Schema-aware binary packing of a validated quiz (share format v1).
 *
 * Output: varint(structure length) + structure + text
 * - structure: counts, flags and string references, as LEB128 varints and bit fields.
 * - text: every distinct string once, UTF-8, each followed by \0, in first-use order.
 *
 * Every string slot in the structure is a varint: 0 = the next new string from the text
 * stream, n > 0 = the string first used as the n-th new string (so repeats cost one byte).
 * Keeping structure and text apart compresses much better than interleaving them.
 */

const questionTypes: readonly QuestionType[] = ["yes-no", "single", "multiple", "order", "match", "solutions"];

// Question header byte: bits 0-2 type, 3 explanation, 4 source, 5 references, 6-7 type-specific.
const hasExplanation = 1 << 3;
const hasSource = 1 << 4;
const hasReferences = 1 << 5;
const typeFlag = 6;

// Quiz header byte.
const hasDescription = 1 << 0;
const hasAuthors = 1 << 1;
const hasLicense = 1 << 2;
const hasPronunciations = 1 << 3;
const fractionalScore = 1 << 4;

class Writer {
  private readonly bytes: number[] = [];
  private readonly strings = new Map<string, number>();
  private readonly text: string[] = [];

  byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  varint(value: number): void {
    let rest = value;
    while (rest >= 0x80) {
      this.bytes.push((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.bytes.push(rest);
  }

  string(value: string): void {
    const index = this.strings.get(value);
    if (index !== undefined) return this.varint(index + 1);
    if (value.includes("\0")) throw new Error("Strings cannot contain a NUL character");
    this.strings.set(value, this.text.length);
    this.text.push(value);
    this.varint(0);
  }

  bits(values: boolean[]): void {
    for (let start = 0; start < values.length; start += 8) {
      let byte = 0;
      values.slice(start, start + 8).forEach((value, bit) => (byte |= Number(value) << bit));
      this.byte(byte);
    }
  }

  finish(): Uint8Array {
    const structure = this.bytes.splice(0);
    this.varint(structure.length);
    const head = this.bytes;
    const text = new TextEncoder().encode(this.text.map((value) => `${value}\0`).join(""));
    const output = new Uint8Array(head.length + structure.length + text.length);
    output.set(head, 0);
    output.set(structure, head.length);
    output.set(text, head.length + structure.length);
    return output;
  }
}

class Reader {
  private position = 0;
  private textPosition: number;
  private readonly end: number;
  private readonly strings: string[] = [];
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });

  constructor(private readonly bytes: Uint8Array) {
    const structureLength = this.varint();
    this.end = this.position + structureLength;
    this.textPosition = this.end;
    if (this.end > bytes.length) throw corrupt();
  }

  byte(): number {
    if (this.position >= this.end) throw corrupt();
    return this.bytes[this.position++]!;
  }

  varint(): number {
    let value = 0;
    for (let shift = 1; ; shift *= 0x80) {
      if (shift > 2 ** 49) throw corrupt();
      const byte = this.bytes[this.position++];
      if (byte === undefined) throw corrupt();
      value += (byte & 0x7f) * shift;
      if (byte < 0x80) return value;
    }
  }

  count(): number {
    const value = this.varint();
    // Every counted item uses at least one structure byte, so larger counts are corrupt.
    if (value > this.end - this.position + 1) throw corrupt();
    return value;
  }

  string<T extends string = string>(): T {
    const reference = this.varint();
    if (reference > 0) {
      const value = this.strings[reference - 1];
      if (value === undefined) throw corrupt();
      return value as T;
    }
    const terminator = this.bytes.indexOf(0, this.textPosition);
    if (terminator < 0) throw corrupt();
    const value = this.decoder.decode(this.bytes.subarray(this.textPosition, terminator));
    this.textPosition = terminator + 1;
    this.strings.push(value);
    return value as T;
  }

  bits(count: number): boolean[] {
    const values: boolean[] = [];
    for (let start = 0; start < count; start += 8) {
      const byte = this.byte();
      for (let bit = 0; bit < 8 && start + bit < count; bit++) values.push(((byte >> bit) & 1) === 1);
    }
    return values;
  }

  finish(): void {
    if (this.position !== this.end || this.textPosition !== this.bytes.length) throw corrupt();
  }
}

function corrupt(): Error {
  return new Error("Corrupt share data");
}

export function pack(data: BunbuData): Uint8Array {
  const writer = new Writer();
  const scoreIsInteger = Number.isInteger(data.passingScore);
  writer.byte(
    (data.description !== undefined ? hasDescription : 0) |
      (data.authors !== undefined ? hasAuthors : 0) |
      (data.license !== undefined ? hasLicense : 0) |
      (data.pronunciations !== undefined ? hasPronunciations : 0) |
      (scoreIsInteger ? 0 : fractionalScore),
  );
  writer.string(data.id);
  writer.string(data.title);
  writer.string(String(data.version));
  writer.string(data.language);
  if (scoreIsInteger) writer.varint(data.passingScore);
  else writer.string(String(data.passingScore));
  if (data.description !== undefined) writer.string(data.description);
  if (data.authors !== undefined) {
    writer.varint(data.authors.length);
    data.authors.forEach((author) => writer.string(author));
  }
  if (data.license !== undefined) writer.string(data.license);
  if (data.pronunciations !== undefined) {
    const entries = Object.entries(data.pronunciations);
    writer.varint(entries.length);
    for (const [term, spoken] of entries) {
      writer.string(term);
      writer.string(spoken);
    }
  }
  writer.varint(data.questions.length);
  data.questions.forEach((question) => writeQuestion(writer, question));
  return writer.finish();
}

export function unpack(bytes: Uint8Array): BunbuData {
  const reader = new Reader(bytes);
  const flags = reader.byte();
  const data: BunbuData = {
    id: reader.string(),
    title: reader.string(),
    version: reader.string(),
    language: reader.string(),
    passingScore: flags & fractionalScore ? Number(reader.string()) : reader.varint(),
    questions: [],
  };
  if (flags & hasDescription) data.description = reader.string<Markdown>();
  if (flags & hasAuthors) data.authors = Array.from({ length: reader.count() }, () => reader.string());
  if (flags & hasLicense) data.license = reader.string();
  if (flags & hasPronunciations) {
    // fromEntries, so a "__proto__" term becomes a normal property.
    data.pronunciations = Object.fromEntries(
      Array.from({ length: reader.count() }, () => [reader.string(), reader.string()]),
    );
  }
  data.questions = Array.from({ length: reader.count() }, () => readQuestion(reader));
  reader.finish();
  return data;
}

function writeQuestion(writer: Writer, question: Question): void {
  let specific = 0;
  if (question.type === "yes-no") specific = question.answer === "yes" ? 1 : 0;
  if (question.type === "multiple") specific = question.scoring === undefined ? 0 : question.scoring === "partial" ? 1 : 2;
  if (question.type === "match") specific = question.distractors === undefined ? 0 : 1;
  writer.byte(
    questionTypes.indexOf(question.type) |
      (question.explanation !== undefined ? hasExplanation : 0) |
      (question.source !== undefined ? hasSource : 0) |
      (question.references !== undefined ? hasReferences : 0) |
      (specific << typeFlag),
  );
  writer.string(question.query);

  switch (question.type) {
    case "yes-no":
      break;
    case "solutions":
      writer.string(question.scenario);
      writeOptions(writer, question.options);
      break;
    case "single":
    case "multiple":
    case "order":
      writeOptions(writer, question.options);
      break;
    case "match":
      writer.varint(question.rows.length);
      writer.bits(question.rows.map((row) => "options" in row));
      for (const row of question.rows) {
        writer.string(row.text);
        if ("options" in row) writeOptions(writer, row.options);
        else writer.string(row.answer);
      }
      if (question.distractors !== undefined) {
        writer.varint(question.distractors.length);
        question.distractors.forEach((distractor) => writer.string(distractor));
      }
      break;
  }

  if (question.explanation !== undefined) writer.string(question.explanation);
  if (question.source !== undefined) writer.string(question.source);
  if (question.references !== undefined) {
    writer.varint(question.references.length);
    for (const reference of question.references) {
      const [text, url] = Object.entries(reference)[0]!;
      writer.string(text);
      writer.string(url);
    }
  }
}

function readQuestion(reader: Reader): Question {
  const header = reader.byte();
  const type = questionTypes[header & 0b111];
  if (type === undefined) throw corrupt();
  const specific = header >> typeFlag;
  const query = reader.string<Markdown>();

  let question: Question;
  switch (type) {
    case "yes-no":
      question = { type, query, answer: specific === 1 ? "yes" : "no" };
      break;
    case "solutions":
      question = { type, query, scenario: reader.string<Markdown>(), options: readOptions(reader) };
      break;
    case "single":
    case "order":
      question = { type, query, options: readOptions(reader) };
      break;
    case "multiple":
      question = { type, query, options: readOptions(reader) };
      if (specific === 1) question.scoring = "partial";
      if (specific === 2) question.scoring = "all";
      break;
    case "match": {
      const count = reader.count();
      const rows: MatchRow[] = reader.bits(count).map((hasOptions) => {
        const text = reader.string<Markdown>();
        return hasOptions ? { text, options: readOptions(reader) } : { text, answer: reader.string<Markdown>() };
      });
      question = { type, query, rows };
      if (specific === 1) question.distractors = Array.from({ length: reader.count() }, () => reader.string<Markdown>());
      break;
    }
  }

  if (header & hasExplanation) question.explanation = reader.string<Markdown>();
  if (header & hasSource) question.source = reader.string<Markdown>();
  if (header & hasReferences) {
    question.references = Array.from({ length: reader.count() }, (): Reference => ({ [reader.string()]: reader.string() }));
  }
  return question;
}

function writeOptions(writer: Writer, options: Option[]): void {
  writer.varint(options.length);
  writer.bits(options.map((option) => option.correct));
  writer.bits(options.map((option) => option.explanation !== undefined));
  for (const option of options) {
    writer.string(option.answer);
    if (option.explanation !== undefined) writer.string(option.explanation);
  }
}

function readOptions(reader: Reader): Option[] {
  const count = reader.count();
  const correct = reader.bits(count);
  const explained = reader.bits(count);
  return correct.map((isCorrect, index) => {
    const option: Option = { answer: reader.string<Markdown>(), correct: isCorrect };
    if (explained[index]) option.explanation = reader.string<Markdown>();
    return option;
  });
}
