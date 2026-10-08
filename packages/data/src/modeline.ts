// \uFEFF is the byte-order mark some editors write before the first line.
const modeline = /^\uFEFF?#\s*yaml-language-server:\s*\$schema=(\S+)/;
const versionedSchema = /\/v(\d+)\.json$/;

export type SchemaReference = { url: string; version: number };

/**
 * Reads the schema reference from the first line of a quiz file, for example
 * `# yaml-language-server: $schema=https://…/schema/v1.json`.
 * Returns an error message when the line is missing or has no version.
 */
export function readSchemaReference(text: string): SchemaReference | string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const url = modeline.exec(firstLine)?.[1];
  if (!url) return "The first line must reference the schema: # yaml-language-server: $schema=<url>";

  const version = versionedSchema.exec(url)?.[1];
  if (!version) return `The schema URL must end in /v<n>.json: ${url}`;

  return { url, version: Number(version) };
}
