import type { Markdown } from "./markdown";

/** A parsed and validated quiz file. Mirrors `schema/v1.json`. */
export interface BunbuData {
  id: string;
  title: string;
  /** Content version, always a string, even when written as a number. */
  version: string;
  language: string;
  description?: Markdown;
  authors?: string[];
  license?: string;
  /** Percentage (0-100) of points needed to pass. */
  passingScore: number;
  pronunciations?: Record<string, string>;
  questions: Question[];
}

export type Question =
  | YesNoQuestion
  | SingleQuestion
  | MultipleQuestion
  | OrderQuestion
  | MatchQuestion
  | SolutionsQuestion;

export type QuestionType = Question["type"];

/** A single `text: url` entry. */
export type Reference = Record<string, string>;

export interface Option {
  answer: Markdown;
  correct: boolean;
  explanation?: Markdown;
}

interface QuestionBase {
  query: Markdown;
  explanation?: Markdown;
  /** Where the question comes from: `text: url` entries. */
  source?: Reference[];
  references?: Reference[];
}

export interface YesNoQuestion extends QuestionBase {
  type: "yes-no";
  answer: "yes" | "no";
}

export interface SingleQuestion extends QuestionBase {
  type: "single";
  options: Option[];
}

export interface MultipleQuestion extends QuestionBase {
  type: "multiple";
  options: Option[];
  scoring?: "partial" | "all";
}

export interface OrderQuestion extends QuestionBase {
  type: "order";
  /** Correct options in the correct order; options with `correct: false` are distractors. */
  options: Option[];
}

export type MatchRow =
  | { text: Markdown; answer: Markdown }
  | { text: Markdown; options: Option[] };

export interface MatchQuestion extends QuestionBase {
  type: "match";
  rows: MatchRow[];
  distractors?: Markdown[];
}

export interface SolutionsQuestion extends QuestionBase {
  type: "solutions";
  scenario: Markdown;
  /** Proposed solutions; `correct: true` means the solution meets the goal. */
  options: Option[];
}
