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

The design docs are the source of truth. When a decision changes the rules, change the design doc
in the same pull request. Where the docs disagree, gameplay.md wins.

## Layout

```text
apps/game/src/
  application.mts  the router; routes come from every ui/**/_routes.mts
  state/      createStore, shared stores (quiz, ambush), settings, selection
    run/      the run's stores, created per run by createRunGame
    practice/ dojo practice's game state
    study/    dojo study's game state
  flows/run/  functions that span the run's stores
  loop.mts    the game loop: time, update, render; play() plugs a game mode in
  render/     viewport, stage (show() puts a view on the canvas), run/ world
  ui/         Rooted components, one folder per screen with its _routes.mts
    shell/    the one canvas and the routed screen on top of it
  fixtures/   dev-only run states, through /fight/?fixture=<name>
apps/game/test/quizzes/   sample quizzes every track develops against
packages/data/            @bunbu/data: reading, validating and sharing quizzes
schema/                   the JSON Schema per format version
```

Rules the linter enforces:

- `state/` and `flows/` are plain TypeScript. They never import `three`, never import `@rooted/*`,
  never import from `render/` or `ui/`, and never touch the DOM.

Conventions the linter can't check:

- A game mode's state is created by its route on mount and dropped on unmount. Only `settings`
  and `selection` are app-wide singletons. Flows take the game (`RunGame`) as an argument.
- Change a store through its actions. Fixtures and tests start a store from a state by passing it
  to the factory (`createRunGame({ life: … })`), not by writing to it.
- A new screen adds a `_routes.mts` next to it; `application.mts` does not change.

## Folder ownership

Each track in [docs/plan.md](docs/plan.md#tracks) owns its folders. Change another track's folder
through a small pull request its owner reviews. `package.json`, `pnpm-lock.yaml`,
`loop.mts` and `ui/fight/run.mts` are shared, so keep changes there to a line or two, and add
dependencies in a pull request of their own.

## Before you push

```sh
pnpm install     # builds @bunbu/data, which the game imports from its dist
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm lint` and `pnpm test` are the two that catch most of it, and CI runs all five on every pull
request. No `eslint-disable` without a comment saying why.

## Seeing your work

```sh
pnpm dev                                  # the game
pnpm dev  # then open /fight/?fixture=ambush-multiple
```

Fixtures put the stores into a named state without playing a run, so a screen can be built and
screenshotted on its own. `/fight/?fixture=` with an unknown name logs the list. They are dev-only; add
the ones your track needs in `apps/game/src/fixtures/`.

## Conventions

- Mobile first, phone portrait. Don't hard-constrain the orientation and don't block desktop.
- Prefer Rooted components over drawing UI in the canvas. The canvas is for the world.
- Stores hold the rules and the timing; the renderer only draws what they say and never calls an
  action. If the canvas were removed, the game would still play correctly to the end.
- Small pull requests, one track each, squash merged to `main`.
- Quiz files are untrusted input: sanitise what you render.
- Write component trees as if you were writing HTML. `append(` gets its own line with its child
  on the next, and the properties passed to `create` and `element` go one per line:

  ```ts
  append(
  	create(Shell, {
  		router: Router
  	})
  )
  ```
