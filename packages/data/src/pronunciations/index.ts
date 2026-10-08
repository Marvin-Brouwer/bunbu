import type { BunbuData } from "../types";
import brands from "./brands.json" with { type: "json" };
import languages from "./languages.json" with { type: "json" };
import technologies from "./technologies.json" with { type: "json" };

/*
 * Built-in pronunciations for generic terms: common technologies, programming and query
 * languages, and brand names. Vendor- or course-specific terms belong in a quiz's own
 * `pronunciations`. The dictionaries are language-agnostic: a quiz in another language
 * overrides the entries it needs. Each term lives in exactly one dictionary (tested).
 *
 * These are the only source to edit. `pnpm build` compiles them into pronunciations/v<n>.g.json,
 * which .bunbu files use; a released version is frozen, so editing these never affects them.
 */

/** The built-in dictionaries by name, for maintenance and tests. */
export const pronunciationDictionaries: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  technologies,
  languages,
  brands,
};

const defaults: Record<string, string> = Object.values(pronunciationDictionaries)
  .reduce<Record<string, string>>((merged, dictionary) => Object.assign(merged, dictionary), {});

/** All built-in pronunciations, merged. */
export function defaultPronunciations(): Record<string, string> {
  return { ...defaults };
}

/** The pronunciations to use for a quiz: the built-in ones, overridden by the quiz's own. */
export function resolvePronunciations(quiz: BunbuData): Record<string, string> {
  return { ...defaults, ...quiz.pronunciations };
}
