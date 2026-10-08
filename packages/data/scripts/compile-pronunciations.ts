// Compiles the built-in pronunciation dictionaries (src/pronunciations/*.json) into
// pronunciations/v<version>.g.json, the frozen copy that .bunbu files of that format version use.
// Runs as part of `pnpm build`. Never edit the generated file: edit the dictionaries instead.
//
// Until a version is released, its file follows the dictionaries on every build. To release it,
// add its version and hash to pronunciations/releases.json (the test prints the hash); from then
// on this script leaves the file alone, and dictionary changes go into the next format version.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const version = 1;
const dictionaries = ["technologies", "languages", "brands"];

// The package root, seen from this script.
const root = new URL("../", import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, root), "utf8")) as T;

const { released } = read<{ released: Record<string, string> }>("pronunciations/releases.json");
const file = `pronunciations/v${version}.g.json`;

if (String(version) in released) {
  console.log(`${file} is released; left unchanged.`);
} else {
  const merged: Record<string, string> = Object.assign(
    {},
    ...dictionaries.map((name) => read<Record<string, string>>(`src/pronunciations/${name}.json`)),
  );
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b, "en")));
  writeFileSync(new URL(file, root), `${JSON.stringify(sorted, null, 2)}\n`);
  const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
  console.log(`${file}: ${Object.keys(sorted).length} entries, sha256 ${hash}`);
}
