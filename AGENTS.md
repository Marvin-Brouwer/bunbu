# Working in this repository

Notes for anyone, human or agent, picking up a task here.

## Read first

| What you need | Where |
| --- | --- |
| What the game is and how a run plays | [docs/design/gameplay.md](docs/design/gameplay.md) |
| The screens, in order | [docs/design/screens.md](docs/design/screens.md) |
| The risk-free training mode | [docs/design/dojo.md](docs/design/dojo.md) |
| The quiz file format | [docs/design/data-format.md](docs/design/data-format.md) |
| 3D assets and their licenses | [docs/design/assets.md](docs/design/assets.md) |
| One canvas, DOM on top | [docs/architecture/rendering.md](docs/architecture/rendering.md) |
| Stores, flows and the game loop | [docs/architecture/state.md](docs/architecture/state.md) |
| Who builds what, in which order | [docs/plan.md](docs/plan.md) |
| Rooted: components, routing, slices | [Rooted guide](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/readme.md) and its [recipe-book example](https://github.com/Marvin-Brouwer/rooted/tree/main/examples/recipe-book) |

The design docs are the source of truth. When a decision changes the rules, change the design doc
in the same pull request. Where the docs disagree, gameplay.md wins.

## Layout

The game is built in **vertical slices**, as Rooted's
[application model](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/application-model.md)
describes: one folder per feature that owns its routes, screens, styles, state and rules. There is
no top-level `components/`, `state/` or `ui/` tree.

```text
apps/game/src/
  application.mts  the Application: the canvas, the game loop and the router
  canvas/          the game loop (play() plugs a mode in), the viewport, show() for a world
  _shared/         what several slices use: state (quiz, ambush, selection), the scroll, the swipe zone, Placeholder
  _temp/           stand-ins until the real thing lands: the fixture quiz
  title/           the title menu (the router's home) and not-found
  fight/           /fight/: quiz select, then the run; state/, flows/, world; _temp/ fixtures
  dojo/            /dojo/: study and practice, each with its own game state
  settings/        /settings/ and the settings store
docs/testdata/            sample quizzes every track develops against (local/ is git-ignored, for your own)
packages/data/            @bunbu/data: reading, validating and sharing quizzes
schema/                   the JSON Schema per format version
```

The slice policy:

- A feature is one folder. Deleting the feature deletes the folder; changing it touches only that
  folder. Its routes go in its own `_routes.mts`; `application.mts` never changes for a new slice.
- Code goes in the slice that uses it. Only when a second slice needs it does it move to
  `_shared/`. A slice may import another slice's routes (for links) and its state, never its
  components.
- Inside a slice, structure is free. A slice's game rules go in `state/` and `flows/` subfolders.
- Only `_shared/`, `_temp/` (at the root or inside a slice, like `fight/_temp/`) and `_routes.mts`
  get a leading underscore; feature folders don't.
- Rooted is a component framework: a reusable piece of UI is a component used with `create`,
  not a function that builds one.

Rules the linter enforces:

- A slice's `state/` and `flows/` are plain TypeScript. They only import from other `state/` and
  `flows/` folders and `@rooted/store`, never `three` or the rest of `@rooted/*`, and never touch
  the DOM. Stores are [`@rooted/store`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/state.md)
  stores with their actions on their state: call `game.life.value.hit(share)`, never `update`.

Conventions the linter can't check:

- A game mode's state is created when the mode starts and dropped when it ends or its route
  unmounts. Only `settings`, `selection`, `highScores`, `lastRun` and the quiz `library` are
  app-wide. Flows take the game (`RunGame`) as an argument.
- Change a store through its actions. Fixtures and tests start a store from a state by passing it
  to the factory (`createRunGame({ life: … })`), not by writing to it.

## Folder ownership

Each track in [docs/plan.md](docs/plan.md#tracks) owns its folders. Change another track's folder
through a small pull request its owner reviews. `package.json`, `pnpm-lock.yaml`,
`canvas/loop.mts` and `fight/run.mts` are shared, so keep changes there to a line or two, and add
dependencies in a commit of their own.

## Before you push

```sh
pnpm install     # builds @bunbu/data, which the game imports from its dist
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm lint` and `pnpm test` are the two that catch most of it, and CI runs all five on every pull
request. No `oxlint-disable` without a comment saying why.

## Seeing your work

```sh
pnpm dev                                  # the game
pnpm dev  # then open /fight/?fixture=ambush-multiple
```

Fixtures put the stores into a named state without playing a run, so a screen can be built and
screenshotted on its own. `/fight/?fixture=` with an unknown name logs the list. They are dev-only; add
the ones your track needs in `apps/game/src/fight/_temp/fixtures.mts`.

## Conventions

- Mobile first, phone portrait. Don't hard-constrain the orientation and don't block desktop.
- Prefer Rooted components over drawing UI in the canvas. The canvas is for the world.
- Stores hold the rules and the timing; the renderer only draws what they say and never calls an
  action. If the canvas were removed, the game would still play correctly to the end.
- Small pull requests, one track each, squash merged to `main`.
- Quiz files are untrusted input: sanitise what you render.
- Write component trees as if you were writing HTML. `append(` gets its own line with its child
  on the next, and the properties passed to `create` and `element` go one per line, each with a trailing comma, as
  in the Rooted guide:

  ```ts
  append(
  	create(RunScreen, {
  		game,
  		leave: showSelect,
  	})
  )
  ```
