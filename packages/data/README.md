# @bunbu/data

Reads, validates and shares Bunbu quizzes. A quiz is a YAML file in the format described in [docs/design/data-format.md](../../docs/design/data-format.md). This package turns such a file into typed data, and packs it into a compact `.bunbu` file for sharing.

It works in the browser and in Node.

## Usage

### Validating a quiz file

```ts
import { validate } from "@bunbu/data";

const result = await validate(yamlText);
if (result instanceof Error) {
  for (const issue of result.issues) console.log(issue.line, issue.path, issue.message);
} else {
  console.log(result.title, result.questions.length);
}
```

`validate` reads the schema version from the file's first line (`# yaml-language-server: $schema=…/schema/v2.json`) and checks the YAML against that schema, which is bundled with the package. Both v1 and v2 are supported. It never throws for invalid input. Instead it returns a `BunbuValidationError`, whose `issues` list a JSON path, a message and, where known, the line in the file.

Markdown fields are checked with `isGfmMarkdown`: headings and raw HTML are not allowed, except inside code. This is a simple placeholder check for now, not a full Markdown parser.

### Sharing as a `.bunbu` file

```ts
import { compress, uncompress, fileExtension, mimeType } from "@bunbu/data";

const bytes = await compress(quiz);   // Uint8Array: the contents of a .bunbu file
const file = new File([bytes], `${quiz.id}${fileExtension}`, { type: mimeType });

const restored = await uncompress(file);   // also accepts a Blob, ArrayBuffer or Uint8Array
```

- **Size:** a `.bunbu` file is typically 6–8 times smaller than the YAML. The quiz is packed into a schema-aware binary form, compressed with LZMA and sealed with a checksum.
- **Not preserved:** comments and YAML formatting. Keep the YAML as the source to edit, and treat `.bunbu` as an export.
- **Errors:** `compress` rejects with a `BunbuValidationError` if the quiz is invalid. `uncompress` treats files as untrusted input:
  - it rejects with a `BunbuShareError` when a file can't be read. Its `reason` is `unknown-format`, `incomplete` or `corrupt`, and its `message` is ready to show to users;
  - it rejects with a `BunbuValidationError` when the decoded quiz isn't valid.

See "Sharing" in the design doc for the file layout.

New exports use binary v2 and keep the `.bunbu` extension. Existing binary v1 files remain
readable with their original pronunciation dictionary. A v1 quiz can be read and re-exported
as v2 without adding any fields.

### Optional custom fields (v2)

Both the quiz and each question can have a `metadata` object with application-owned,
JSON-compatible values. Use a namespace per application, for example:

```yaml
metadata:
  examPrep:
    domain: containers
    caseGroup: northwind-research
```

These are example application fields, not requirements of the format. Bunbu does not
interpret them. Validation, `.bunbu` exports and imports preserve all metadata, including
unknown namespaces. Metadata can be absent or empty; existing quizzes work unchanged.
The reader limits metadata to 64 object or array levels, counting the metadata object itself,
so recursive schema validation remains safe for untrusted files.
The consuming application owns validation and any fallback when its custom fields are missing.
See [the complete sample](../../docs/testdata/custom-metadata.yaml).

### Pronunciations

```ts
import { resolvePronunciations } from "@bunbu/data";

const dictionary = resolvePronunciations(quiz);   // built-in entries, overridden by the quiz's own
```

Use the result to rewrite text before sending it to the browser's speech engine. See [Dictionaries](#dictionaries) below.

## Dictionaries

The package ships three pronunciation dictionaries for generic terms, so quizzes don't have to repeat them:

| File | Contains | Examples |
| --- | --- | --- |
| [src/pronunciations/technologies.json](src/pronunciations/technologies.json) | Common technologies, protocols and formats | `TCP`, `UUID`, `JSON`, `UTP` |
| [src/pronunciations/languages.json](src/pronunciations/languages.json) | Programming and query languages | `SQL`, `NoSQL`, `C#` |
| [src/pronunciations/brands.json](src/pronunciations/brands.json) | Product and brand names | `Redis`, `nginx`, `Kubernetes` |

Each file is a flat `"term": "spoken text"` map. The dictionaries are language-agnostic: they apply to every quiz, and a quiz in another language overrides the entries it needs in its own `pronunciations`.

### Adding or changing a term

1. **Edit only the three files above.** They are the single source.
2. **Keep it generic.** A term belongs here if quizzes on unrelated subjects would use it. Vendor- or course-specific terms, such as `RBAC`, `AKS` or `KQL`, belong in the quiz itself.
3. **Put each term in exactly one dictionary.** A test fails on duplicates.
4. **Write the spoken text the way you'd want it read**, such as `T C P` for letters spelled out, or `sequel` and `reh dis` for words.
5. **Run `pnpm build`.** It recompiles the generated file described below. The tests fail if you forget.

### The generated file

`.bunbu` files leave out pronunciation entries that equal the built-in ones, and restore them when read. For that to stay correct, every file must be read against exactly the built-in list it was written with. So the dictionaries are compiled into a frozen copy per `.bunbu` format version:

- [pronunciations/v1.g.json](pronunciations/v1.g.json) is frozen for existing v1 files. [pronunciations/v2.g.json](pronunciations/v2.g.json) is the current generated copy, built by [scripts/compile-pronunciations.ts](scripts/compile-pronunciations.ts). Never edit either by hand. The `.g.json` suffix marks it as generated, and [.gitattributes](../../.gitattributes) collapses it in pull request diffs.
- [pronunciations/releases.json](pronunciations/releases.json): records which versions are released.

**Before a version is released**, every `pnpm build` regenerates its file from the dictionaries.

**To release a version**, add its version and hash to `releases.json`. The build prints the hash:

```json
{
  "released": {
    "1": "8bdbe84b0bec14dbfdb846ae9ad6deecf3aadf15f2a3e4b9bb2a9033ea80a49b",
    "2": "<hash printed by the v2 build>"
  }
}
```

From then on, the build leaves that file alone, and a test checks that it never changes. You can keep editing the dictionaries: YAML quizzes use them immediately, and existing `.bunbu` files are unaffected. To also leave newer built-in entries out of `.bunbu` files, introduce the next format version, which gets its own generated file.

## Development

| Command | What it does |
| --- | --- |
| `pnpm build` | Compiles the pronunciation dictionaries, then bundles `dist/` with rolldown |
| `pnpm test` | Runs the tests in `test/` |
| `pnpm typecheck` | Type-checks the source, tests and scripts |
| `pnpm bench` | Compares compression codecs on generated quizzes (takes about a minute; not part of `pnpm test`) |
| `pnpm pronunciations` | Only recompiles the pronunciation dictionaries |

The JSON Schemas live at the repository root: [schema/v2.json](../../schema/v2.json) is current and [schema/v1.json](../../schema/v1.json) remains available for old files. Tests validate the documented examples and cover metadata preservation and v1 compatibility.
