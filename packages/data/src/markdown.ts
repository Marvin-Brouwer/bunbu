/** A string containing GitHub-flavored Markdown, checked by {@link isGfmMarkdown}. */
export type Markdown = string & { readonly __markdown: true };

// Placeholder checks until we parse GFM properly. Code is stripped first,
// so `<table>` in inline code or `# comment` in a code block stays valid.
const fencedCode = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm;
const inlineCode = /(`+)[\s\S]*?\1/g;
const atxHeading = /^ {0,3}#{1,6}(?:[ \t]|$)/m;
const setextHeading = /^ {0,3}\S[^\n]*\n {0,3}(?:=+|-{2,})[ \t]*$/m;
const htmlTag = /<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/;

/** Whether the value is Markdown the app can render: no headings and no raw HTML. */
export function isGfmMarkdown(value: string): boolean {
  const text = value.replace(fencedCode, "").replace(inlineCode, "");
  return !atxHeading.test(text) && !setextHeading.test(text) && !htmlTag.test(text);
}
