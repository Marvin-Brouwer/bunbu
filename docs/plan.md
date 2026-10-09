# Build plan

How to build the game with 1 to 3 people (and their AI agents) working at the same time. What to build is in [docs/design](design), how it is put together in [docs/architecture](architecture). This file only says in which order, and who can work on what without stepping on each other.

## How the work is split

The architecture already gives us clean seams: stores and flows hold all rules and know nothing about the screen, the canvas only reads stores, and the DOM only reads stores and calls actions. So the work splits along those seams:

1. **Foundation** is done first, by one person. It fixes the contracts (store state types and action signatures), the folder layout and the tooling, so everyone after it codes against the same shapes.
2. After that, **eight tracks** run in parallel. Each track owns its own folders. A track that needs another track's output works against the contract and a fixture until the real thing lands.

```text
                     ┌─► A  Rules: ambush and questions ─┐
                     ├─► B  Rules: run, score, life ─────┤
                     ├─► C  Swipe input ─────────────────┤
0  Foundation ───────┼─► D  Scroll and HUD ──────────────┼─► M1 … M4 milestones
   (contracts)       ├─► E  3D world (code) ─────────────┤
                     ├─► F  3D assets (Blender) ─────────┤
                     ├─► G  Menus and results ───────────┤
                     └─► H  Dojo ────────────────────────┘
```

## 0 Foundation (blocking, one person)

Everything else waits for this, so keep it small: shapes and plumbing, no rules.

- **Linting.** [oxlint](https://oxc.rs/docs/guide/usage/linter), type-aware, at the repo root (`oxlint.config.ts`), with typescript-eslint's strict and stylistic type-checked rules, covering `apps/*` and `packages/*`. Add the import boundary from [state.md](architecture/state.md#folder-layout): a slice's `state/` and `flows/` only import from other `state/` and `flows/` folders, and never import `three` or touch the DOM. `pnpm lint` at the root, and fix what it finds in `packages/data`.
- **CI.** A GitHub Actions workflow on pull requests: install, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Required to be green before merge.
- **Dependencies.** Add `three` and `@types/three` to `apps/game`, and `vitest` for game tests.
- **Folders.** Vertical slices as in [state.md](architecture/state.md#folder-layout) and the [Rooted application model](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/application-model.md): one folder per feature (`title/`, `fight/`, `dojo/`, `settings/`), plus `canvas/` for the loop and the renderer, `_shared/` for what several slices use and `_temp/` for stand-ins.
- **Stores** on [`@rooted/store`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/state.md), with their actions on their state.
- **Contracts.** One module per store with its **state type and action signatures**, and a stub body that just does the obvious thing. Each game mode has its own state, created when its route mounts: the run (`run`, `quiz`, `ambush`, `score`, `life`, `shogun`, `ninjas`), practice (`quiz`, `ambush`, `tally`) and study (`quiz`, `reading`). Only `settings` and `selection` are app-wide. This is the most important part of the foundation: tracks D, E, G and H build against these types before A and B fill them in. Changing a contract after this is a small PR of its own that every track rebases on.
- **Routing.** `@rooted/router` for app navigation: each slice has its own `_routes.mts`, collected into one route manifest at build time.
- **Fixtures.** A dev-only way to start a run from a named state, for example `/fight/?fixture=ambush-multiple`, `/fight/?fixture=fallen`, in `apps/game/src/fight/_temp/fixtures.mts`. UI and render tracks use these to build and screenshot their work without playing a run.
- **Sample quizzes.** A few YAML quizzes in `docs/testdata/` that cover every question type, 2 to 8 options, long code blocks and an image. Valid against `@bunbu/data`.
- **Application.** The layer container from [rendering.md](architecture/rendering.md#layers), in the `Application` component: full-viewport container, canvas with a `ResizeObserver`, one empty slot per layer, and the game loop with clamped delta, pause and `visibilitychange`. Rendering a grey floor and a cube is enough.
- **Agent notes.** An `AGENTS.md` (or `CLAUDE.md`) at the root that points agents at `docs/`, the folder ownership below, and "run `pnpm lint` and `pnpm test` before you push".

Done when: `pnpm dev` shows the cube, every fixture loads, CI is green, and every store module exports its full typed API.

## Tracks

Every track:

- owns the folders listed with it, and only changes another track's folder through a small PR that the owner reviews;
- ships with tests where the code is plain TypeScript (A, B, C and the logic parts of the others);
- uses fixtures to show its work, and adds the fixtures it needs.

### A. Rules: ambush and questions

Owns `_shared/state/ambush.mts`, `_shared/state/quiz.mts`, `fight/state/ninjas.mts`, `fight/flows/ambush*.mts`.

The heart of the game, all plain TypeScript and unit tests, no screen needed.

- Turn every question type into ambushes: `yes-no`, `single`, `multiple`, `order`, one ambush per `solutions` entry, one `single`-style ambush per `match` row ([per question type](design/gameplay.md#per-question-type)).
- Assign marks to options: shuffle, one of 8 directions per option, 1 to 5 ninjas (3 front, 2 behind), bundling for 6 to 8 options ([more than 3 options](design/gameplay.md#more-than-3-options)).
- Picks: pick, unpick by picking again, order numbers for `order`, commit.
- Outcome: correct when every slash is on a correct option and every block on a wrong one. Correct, wrong and unanswered, including the half-swiped rule.
- Time limit: `ambushSeconds` from word count (code counts double) and question type, times `timeScale`, minimum 5 s ([time limit](design/gameplay.md#time-limit)). All numbers in one config object.
- Ninja approach as a function of time left, so the creeping ninjas are the timer.
- Record misses with what was picked, for the review.

### B. Rules: run, score, life, persistence

Owns `fight/state/` (except `ninjas.mts`), `settings/state/`, `_shared/state/selection.mts`, `fight/flows/run*.mts`, `_shared/storage/`.

- Run phases (`intro`, `running`, `ambush`, `paused`, `finished`, `fallen`), run time, slow-motion scale, distance, when the next ambush triggers.
- Life bar: `(best still possible − pass) / (1 − pass)`, each miss takes its question's full share, empty bar means fallen ([life bar](design/gameplay.md#life-bar)).
- Score: 100 per correct, total run time, high score per quiz `id` + `version`, only passed runs count, equal score is won by the shorter time ([score](design/gameplay.md#score)). The store contracts and [state.md](architecture/state.md#stores) follow this: `addCorrect()` has no time bonus.
- Pause, resume with 3-2-1, auto-pause on `visibilitychange`.
- Persistence in local storage through [`@rooted/storage`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/storage.md) (typed, JSON round-trip, safe during pre-rendering): settings, high scores, last run's misses (for "practise mistakes"), loaded quizzes. Version the stored shape. Its guide shows how to pair it with a store.

### C. Swipe input

Owns `_shared/swipe/` (the run and practice both use it).

Pure gesture logic with tests on recorded pointer sequences, plus the swipe zone component.

- Pointer events in the swipe zone only, so the scroll above keeps native scrolling.
- Classify a stroke into the 8 directions, with a dead zone for taps and jitter.
- One continuous stroke can pick several marks (← → in one go); lifting between swipes is optional.
- 0.8 s pause after lifting commits for `multiple` and `order`; a single swipe commits at once for `yes-no` and `single`.
- Calls `ambush.pick()` and `ambush.commit()`, nothing else.
- The mark legend: ninja figures with their arrows, picked marks highlighted, order numbers.
- Haptics through `navigator.vibrate`, behind the setting.
- Test on a real phone early: iOS Safari edge swipes and pull-to-refresh are the usual traps (`touch-action`, `overscroll-behavior`).

### D. Scroll and HUD

Owns `_shared/scroll/`, `_shared/markdown/`, `fight/hud/` and the theme in `application.css`.

- Theme: papyrus, ink, fonts, colours as CSS custom properties, shared by every DOM component.
- Markdown to HTML for queries, options, explanations: GFM, code blocks with highlighting, images (SVG as `<img>`, never inline), no raw HTML. Sanitise; quizzes are untrusted input. [`@rooted/markdown`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/markdown.md) does not cover this: it parses `.md` files at build time and doesn't sanitise, while quiz Markdown arrives at runtime from the player. Bring a runtime parser and sanitiser.
- The scroll: header (`AMBUSH · MULTIPLE · CHOOSE 2`), query, code, options with marks, `MARKED` state, order numbers, "2 of 3" for solutions. Unroll, roll-up, and being sliced in half on unanswered.
- HUD: score with best to beat, life bar with the flashing lost chunk, pause button, progress bar with stage name, distance and ambush ticks.
- Red edge flash on a hit, `+100` pop-up on correct.

### E. 3D world (code)

Owns `canvas/` and `fight/world/` (the run's world).

Builds against placeholder models (capsules and boxes) until F delivers, so it never waits on art.

- Renderer setup as in [rendering.md](architecture/rendering.md#renderer-setup): pixel ratio cap, resize, alpha only if there is a CSS backdrop.
- The stage: a path with corners and curves at constant pace, instanced props, at least one stage (Castle town: streets and gardens) to start, the other four later.
- Camera that follows the shogun, centred, portrait framing that also survives landscape.
- Shogun: run, strike, block, hurt and fallen clips driven by `shogun` state, timed to the state rather than to the clip.
- Ninjas: one mesh per ninja in the store, approach position from `ninjas` state (they are the timer), slain, blocked and flee, landing the hit, front then back waves.
- Effects: slash trail, ink splash, petals. Second pass for effects that must sit on top.
- Title screen samurai under a torii, fallen samurai in ink-wash grey, the training dummy for the dojo.
- Asset loading with GLTFLoader, meshopt and KTX2, with a loading state.

### F. 3D assets (Blender, little code)

Owns `apps/game/public/models/`, `assets/` (source files) and `ATTRIBUTION.md`.

A good track for someone who'd rather not write TypeScript.

- Samurai: retarget the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) clips onto the LOWPO samurai, export one GLB with all clips ([assets.md](design/assets.md#chosen-characters)).
- Ninja: check the Quaternius ninja next to the samurai, add missing clips (block, flee, hit) the same way.
- Training dummy and bamboo sword for the dojo.
- Stage props for the first stage: path, torii, rice fields, trees recoloured to blossom.
- `gltf-transform optimize` script in the repo so every GLB is compressed the same way.
- Agree on clip names with E up front (`run`, `strike`, `block`, `hurt`, `fallen`, …) and write them down in `assets.md`.
- The attribution file, from the first CC-BY asset on.

### G. Menus and results

Owns `title/`, `settings/` (except `state/`), the `fight/` screens (quiz select, the run screen and its overlays: pause, results, fallen) and `application.mts`.

- Title / menu (1), quiz and stage select (2) with quiz cards, **Load .yaml** and `.bunbu` through `validate` and `uncompress` from `@bunbu/data`, showing their errors to the user. Novice / Adept / Master.
- Pause (6), settings (difficulty, haptics, volume).
- Static pages such as asset credits and how to play as `.md` files through [`@rooted/markdown`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/markdown.md), which renders them at build time.
- A "new version" notice on the title screen with [`@rooted/pwa`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/pwa.md), so an update never lands in the middle of a run.
- Finished (7) and fallen (8), with the mistakes review scroll: your pick, the right answer, explanations, references.
- Navigation between screens with `@rooted/router`: `Link` and `navigate`, one `_routes.mts` per screen folder. `/fight/` is the quiz select screen and the run in its place; pause, results and fallen are phases of the run shown over its world.

### H. Dojo

Owns `dojo/` and `_shared/speech/`.

- Speech: a small wrapper around `speechSynthesis`, voice per quiz `language`, speed, pronunciations through `resolvePronunciations`, word boundary events for highlighting. Test on iOS and Android early; boundary events and voice lists differ a lot.
- Study (D2): shuffled loop, "the answer is …" per type, the spoken word highlighted with grey background and underline, pause and restart.
- Dojo menu (D1) and practice start (D3).
- Practice (D4, D5): reuses the scroll from D and the swipe zone from C with a practice flow: no timer, no life, dummies, right vs wrong percentage, the miss screen with **Continue** and the speaker button.
- "Only my mistakes from the last run", using the misses B stores.

Study only needs the foundation and can start right away. Practice needs C and D to be usable, so do Study first.

## Milestones

Each milestone is something you can play on a phone.

| Milestone | Playable | Needs |
| --- | --- | --- |
| **M1 Walking skeleton** | Start a run on a sample quiz, cubes run, `yes-no` and `single` ambushes with a basic scroll and swipe, life bar drops, finished or fallen screen. Ugly is fine. | A, B, C basics, D basics, E with placeholders, G results stub |
| **M2 All question types** | Every type, 2 to 8 options with bundling, `order` numbers, unanswered, pause, real score and high score. | A, B, C, D complete |
| **M3 It looks like Bunbu** | Real samurai and ninjas, first stage, all menus, review scroll, loading your own `.yaml`. | E, F, G |
| **M4 Dojo** | Study with speech and highlighting, practice, practise mistakes. | H |

After M4: playtest and tune the timer numbers, `timeScale` and the 0.8 s commit pause, then the other four stages.

## Who does what

The tracks are sized so that they can be shared out evenly. Foundation is always one person, first.

| People | Person 1 | Person 2 | Person 3 |
| --- | --- | --- | --- |
| **1** | 0, then A, B, C, D, E, G, H in milestone order, F whenever you need a break from code | | |
| **2** | 0, A, B, C, then H | D, E, G, F | |
| **3** | 0, A, B, then H | C, D, then G | E and F |

With three people the second and third person start on their tracks against the stubs as soon as the contracts from the foundation are merged; they don't need to wait for the rest of the foundation.

## Working rules

- **Small PRs, one track each.** Prefer several PRs per track over one big one. Squash merge to `main`.
- **Contracts change first.** If a track needs a store to look different, that is its own small PR to the store's owner, merged before the code that uses it.
- **Shared files are hot spots.** `package.json`, `pnpm-lock.yaml`, `canvas/loop.mts` and `fight/run.mts` will conflict. Add dependencies in a commit of their own, and keep what a track mounts in the run screen to one line. Routes need no shared file: a slice's own `_routes.mts` registers it.
- **Lint, typecheck and tests green** before a PR, locally and in CI. No `oxlint-disable` without a comment saying why.
- **Docs stay the source of truth.** When a decision changes the rules, update the design doc in the same PR.
- **Agents get a brief per task.** Point the agent at this file, its track, the design section it implements, and the folders it may touch.

## Open questions

Decisions the docs don't make yet. Each has a default so nobody is blocked; change it when you decide.

| Question | Default until decided | Affects |
| --- | --- | --- |
| How do stage length and question count relate? The wireframe shows `860 / 1,500 m` with ambush ticks. | Stage length scales with the number of questions, ambushes evenly spaced. One run = one quiz on one stage. | B, D, E |
| The progress bar shows "a block marks the boss". What is the boss? | No boss in M1 to M4. | B, E |
| What does "Next stage" on the results screen do with the same quiz? | Restart the same quiz on the next stage. | G |
| Exact Novice / Adept / Master values. | Novice `off`, Adept `1.5`, Master `1`, using the values in [time limit](design/gameplay.md#time-limit). | A, G |
| Sound and music. | None until after M4; the volume setting exists but does nothing yet. | — |
