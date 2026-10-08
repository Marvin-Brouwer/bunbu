# Data format

A general-purpose, file-based format for quizzes and practice tests.

## Goals

- **Authorable by hand.** A quiz is a single text file that can be written in any editor, reviewed in a pull request and diffed.
- **Validated while typing.** Editors get autocomplete and errors from a published JSON Schema.
- **Rich text.** Questions, options and explanations support Markdown, including code blocks.
- **Several question types** with one consistent way of declaring options and which ones are correct.
- **Scenario questions.** One scenario can be tested against several proposed solutions.
- **Versioned.** The format version and the content version are tracked separately.
- **Speakable.** A pronunciation dictionary helps the browser Speech API read domain terms aloud correctly.
- **Traceable.** Every question can say where its content and correct answer come from.

## Non-goals

- Free-text answers. They cannot be graded reliably, so every question type has a fixed set of options.
- Translations. A quiz is written in one language, set by `language`.
- Sharing a quiz inside a URL, for now. This is planned for later with aggressive compression, so the format should stay compact and avoid redundancy.
- Storing user progress, scores or attempt history. That belongs in the app, not in the quiz file.
- Defining test modes, such as question counts or time limits. The app decides these.
- Defining how the app looks or how navigation behaves.

## Format choice: YAML + JSON Schema

YAML is widely supported, easy to edit by hand, allows comments and multi-line strings without escaping, and can be validated with JSON Schema.
If we later share quizzes through a URL, YAML is also more compact to URL-encode than the equivalent JSON.

The schema is published from this repository and referenced through a raw GitHub URL in the first line of the file. The format version is part of that URL:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/tbd/v1/bunbu.schema.json
```

> Use a `raw.githubusercontent.com` URL. A `github.com/.../blob/...` URL returns an HTML page, not the schema.

## Versioning

There are two independent versions:

| Where                    | Meaning                     | Who changes it                              |
| ------------------------ | --------------------------- | ------------------------------------------- |
| `v<n>` in the schema URL | Version of this data format | Bunbu, only for breaking changes.           |
| `version` field          | Version of the quiz content | The quiz author, whenever questions change. |

The schema line is required. The app reads the format version from it before parsing, and rejects files without it or with an unknown version.

- Non-breaking additions, such as a new optional field or a new question type, are added to the existing schema and keep the same URL.
- Breaking changes publish a new schema under `v<n+1>/`. Older schemas stay online so existing files keep validating.
- `version` is a free string (for example `1`, `2026-10`, `1.4.0`). The app may use it to invalidate stored progress when the content changes.

## Document structure

```yaml
id: web-fundamentals      # required, stable slug, used as storage key
title: Web fundamentals   # required
version: '3'              # required, content version
language: en              # required, BCP 47 tag, also selects the speech voice
description: >-           # optional, Markdown
  Practice questions about HTTP, HTML and CSS.
authors: [Jane Doe]       # optional
license: CC-BY-4.0        # optional, SPDX identifier for the content
passingScore: 70          # required, percentage (0-100) needed to pass

pronunciations: {}        # optional, see Pronunciations
questions: []             # required, at least one question
```

`passingScore` is the percentage of points needed to pass. Each question is worth one point, and each proposed solution in a `solutions` question also counts as one point. A question with `scoring: partial` can earn part of its point.

## Markdown

All long-form text fields (`description`, `query`, option text, `explanation`, scenario text) are GitHub-flavored Markdown:

- **Allowed:** emphasis, inline code, fenced code blocks with a language, lists, tables, links and images.
- **Not allowed:** headings. The app owns the page structure, so headings would conflict with it. The parser rejects or downgrades them.
- **No raw HTML.** The app renders untrusted files, so HTML is escaped.

Write Markdown values as YAML block scalars, even when they fit on one line. This makes it clear which values are Markdown, and avoids quoting problems with characters such as `` ` ``, `*` and `:`. All examples in this document follow this rule.

- `>-` folds lines into one paragraph. Use it for plain text.
- `|-` keeps line breaks. Use it for lists, code blocks and multiple paragraphs.

## Pronunciations

The browser's `SpeechSynthesis` API has no reliable support for phonetic markup (SSML) across browsers. Domain terms such as abbreviations, product names and identifiers are often read incorrectly as a result.

The pronunciation dictionary maps a written term to the text that should be spoken instead. The app applies it only to the text it sends to the speech engine. What is displayed is never changed.

```yaml
pronunciations:
  SQL: sequel
  nginx: engine x
  kubectl: cube control
  CSS: C S S
  GIF: jif
```

Rules:

- Matches are whole-word and case-sensitive, so `SQL` does not match `sql_mode`.
- Longer keys are matched before shorter ones, so `HTTP/2` is replaced before `HTTP`.
- Code blocks are not read out by default. Inline code is read, after replacement.
- The voice is chosen from the document's `language`.

## Questions

### Common fields

Questions have no id. They are identified by their position in `questions`. Progress the app stores is tied to the quiz `id` and `version`, so authors bump `version` when they add, remove or reorder questions.

| Field         | Required | Description                                                                                         |
| ------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `type`        | yes      | One of the types below.                                                                             |
| `query`       | yes      | The question, in Markdown.                                                                          |
| `explanation` | no       | Markdown shown after answering. Explain why the answer is correct and why the alternatives are not. |
| `source`      | no       | Where the question comes from (origin and attribution), in Markdown, such as a link or a credit.    |
| `references`  | no       | List of `text: url` entries where the answer can be verified. Plain text, not Markdown.             |

### Options

Options are a **list**. Each option says itself whether it is correct, so there are no keys or positions to keep in sync, and the app can shuffle options freely.

| Field         | Required | Description                                                           |
| ------------- | -------- | --------------------------------------------------------------------- |
| `answer`      | yes      | The option text, in Markdown.                                         |
| `correct`     | yes      | `true` or `false`.                                                    |
| `explanation` | no       | Markdown shown next to this option after answering.                   |

```yaml
options:
  - correct: true
    answer: >-
      `alt`
  - correct: false
    answer: >-
      `title`
    explanation: >-
      Shown as a tooltip, but not reliably read by screen readers.
```

The app always shuffles options. Avoid options that depend on their position, such as *"All of the above"*.

### Question types

#### `yes-no`

A statement that is either correct or not.

````yaml
- type: yes-no
  query: |-
    A client sends this request twice because the first response timed out:

    ```http
    PUT /users/42 HTTP/1.1
    Content-Type: application/json

    { "name": "Ada", "role": "admin" }
    ```

    Is the result on the server the same as sending it **once**?
  answer: yes
  explanation: |-
    `PUT` is *idempotent*: it replaces the resource with the given state,
    so repeating it leaves the resource in the same state.

    This is not true for `POST`, which may create a second user.
  references:
    - RFC 9110, section 9.2.2: https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2
````

#### `single`

Exactly one option is correct.

````yaml
- type: single
  query: |-
    A screen reader announces this image only as *"image"*:

    ```html
    <img src="chart.png">
    ```

    Which attribute should be added so it is described properly?
  options:
    - correct: true
      answer: >-
        `alt`
    - correct: false
      answer: >-
        `title`
      explanation: >-
        Shown as a tooltip, but not reliably read by screen readers.
    - correct: false
      answer: >-
        `aria-label` on the parent element
    - correct: false
      answer: >-
        `caption`
      explanation: >-
        Only valid on `<table>`, not on images.
  explanation: >-
    `alt` is the text alternative for an image. Use an **empty** `alt=""`
    for purely decorative images, so screen readers skip them.
````

#### `multiple`

One or more options are correct. The app tells the user how many to choose.

```yaml
- type: multiple
  query: >-
    Which HTTP methods are defined as **safe**, meaning they are not expected
    to change any state on the server?
  options:
    - correct: true
      answer: >-
        `GET`
    - correct: true
      answer: >-
        `HEAD`
    - correct: false
      answer: >-
        `POST`
    - correct: false
      answer: >-
        `DELETE`
  scoring: partial      # partial | all (default: all)
  explanation: |-
    | Method   | Safe | Idempotent |
    | -------- | ---- | ---------- |
    | `GET`    | yes  | yes        |
    | `HEAD`   | yes  | yes        |
    | `POST`   | no   | no         |
    | `DELETE` | no   | yes        |
```

#### `order`

Put the correct options in sequence. The correct options are written **in the correct order**. Options with `correct: false` are distractors: the user must leave them out, and their position in the list does not matter.

```yaml
- type: order
  query: >-
    Several rules set the `color` of the same element.
    Order them from **lowest** to **highest** precedence.
  options:
    - correct: true
      answer: >-
        User-agent stylesheet
    - correct: true
      answer: >-
        Author stylesheet
    - correct: true
      answer: >-
        Inline `style` attribute
    - correct: true
      answer: >-
        Author `!important` declaration
```

```yaml
- type: order
  query: |-
    You are on `main` with uncommitted changes. You want to:

    1. Put the changes on a new branch called `feature`.
    2. Commit them.
    3. Make the branch available on the remote.

    Which **three** commands do this, in order?
  options:
    - correct: true
      answer: >-
        `git switch -c feature`
    - correct: true
      answer: >-
        `git commit -am "Add feature"`
    - correct: true
      answer: >-
        `git push -u origin feature`
    - correct: false
      answer: >-
        `git rebase main`
    - correct: false
      answer: >-
        `git stash`
      explanation: >-
        `git switch -c` keeps uncommitted changes, so stashing is not needed.
  explanation: >-
    `-u` sets the upstream, so later pushes need no arguments.
```

The app shuffles the options, and guarantees that the starting order differs from the correct order.

#### `match`

Pair each row with an option. Each row is a list item with its `text` and the `answer` it matches. All row answers together form one shared pool of options, and the same answer may appear in several rows. `distractors` adds options that match no row.

```yaml
- type: match
  query: >-
    Match each status code to its meaning.
  rows:
    - text: >-
        `200`
      answer: >-
        Success
    - text: >-
        `301`
      answer: >-
        Permanent redirect
    - text: >-
        `404`
      answer: >-
        Resource not found
    - text: >-
        `503`
      answer: >-
        Service temporarily unavailable
  distractors:
    - >-
      Access denied
```

When each row needs its own choices (a grid of drop-downs), give the row `options` instead of `answer`. These work like the options of a `single` question.

```yaml
- type: match
  query: >-
    Choose the best tool for each requirement.
  rows:
    - text: >-
        Distribute items along a single row
      options:
        - correct: true
          answer: >-
            `display: flex`
        - correct: false
          answer: >-
            `display: grid`
        - correct: false
          answer: >-
            `float: left`
    - text: >-
        Align items in rows and columns at the same time
      options:
        - correct: false
          answer: >-
            `display: flex`
        - correct: true
          answer: >-
            `display: grid`
        - correct: false
          answer: >-
            `<table>` markup
```

The app shuffles both the rows and the options.

#### `solutions`

A scenario with a goal, and several proposed solutions. The scenario and the question stay the same, and only the proposed solution changes. For each solution the user answers whether it meets the goal.

The app asks about the solutions one at a time, in random order. An answer is final once the user moves on, because later solutions could reveal earlier answers. Each solution is scored separately.

```yaml
- type: solutions
  scenario: |-
    A single-page app calls a third-party weather API. Every request needs a
    secret key in the `X-Api-Key` header.

    Requirements:

    - The key must **never** be visible to end users, including in dev tools.
    - The key can be rotated without rebuilding the frontend.
  query: >-
    Does this solution meet the goal?
  options:
    - correct: false
      answer: >-
        Inject the key at build time as an environment variable.
      explanation: >-
        Build-time variables are embedded in the shipped JavaScript bundle.
    - correct: true
      answer: >-
        Call the API through your own backend, which adds the key.
    - correct: false
      answer: >-
        Store the key in the code, base64-encoded.
      explanation: >-
        Encoding is not encryption. Anyone can decode it from the bundle.
```

Here `correct: true` means the solution meets the goal.

## Media

Images are referenced with Markdown. A quiz is always a single YAML file, so relative paths are not allowed, because there is nothing next to the file to resolve them against.

Alt text is required, because it is also what the speech engine reads.

**Prefer absolute `https:` URLs.** They keep the file small and readable.

```yaml
query: |-
  What does the highlighted area in this diagram represent?

  ![Box model diagram with the padding area highlighted](https://example.com/images/box-model.svg)
```

**Use a base64 `data:` URI only when the image cannot be hosted.** It makes the file self-contained, but larger and harder to read.

```yaml
query: |-
  What does the highlighted area in this diagram represent?

  ![Box model diagram with the padding area highlighted](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...)
```

- Use `|-` for text that contains an embedded image, so the base64 data stays on one line.
- Base64 makes an image about a third larger, so keep embedded images small: prefer SVG for diagrams, and WebP or compressed PNG for screenshots.
- Allowed types are `image/png`, `image/jpeg`, `image/webp`, `image/gif` and `image/svg+xml`. The app renders SVG as an image, never inline, so scripts in it do not run.

## Full example

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/tbd/v1/bunbu.schema.json

id: example
title: Example quiz
version: '1'
language: en
passingScore: 70

pronunciations:
  SQL: sequel

questions:
  - type: yes-no
    query: >-
      Is this a yes/no question?
    answer: yes
    source: >-
      Written for this example

  - type: single
    query: >-
      Which of these is a query language?
    options:
      - correct: false
        answer: >-
          HTML
      - correct: true
        answer: >-
          SQL
      - correct: false
        answer: >-
          CSS
      - correct: false
        answer: >-
          SVG
    explanation: >-
      **SQL** is used to query relational databases.
      The others describe documents or presentation.
    references:
      - MDN, SQL: https://developer.mozilla.org/en-US/docs/Glossary/SQL

  - type: multiple
    query: >-
      Which of these are markup languages?
    options:
      - correct: true
        answer: >-
          HTML
      - correct: false
        answer: >-
          SQL
      - correct: true
        answer: >-
          SVG
      - correct: false
        answer: >-
          JSON
```

## Open questions

- **Schema location.** Decide the final path that replaces `tbd/` before publishing `v1`.
