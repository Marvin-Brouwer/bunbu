# Game state

How the game keeps its state, who may change it, and how the screen follows it. The screen itself (one three.js canvas with Rooted components on top) is described in [rendering.md](rendering.md).

## The idea

- The game state lives in **several small stores**, one per concern: the run, the score, the life bar, the shogun, the ninjas, the current ambush.
- Each **game mode** (the run, dojo practice, dojo study) has its own set of stores. Its route creates them when it mounts and drops them when it unmounts, so nothing carries over from one run to the next or into the dojo.
- Only **settings**, the **selection** (the chosen quiz and stage) and what outlives a run (**high scores**, the **last run's misses**, the **library** of loaded quizzes) are app-wide. Moving between screens is routing ([@rooted/router](https://www.npmjs.com/package/@rooted/router)), not state.
- Each store owns its state and exposes **functions that change it** (actions). Nothing else writes to a store.
- Most stores are small **state machines**: they have a phase, and their actions only allow the transitions that make sense from that phase.
- The **canvas only renders**. On every frame of the game loop it reads the stores and makes the scene match. It holds no rules, no timers and no score, and it never calls an action.
- The **DOM components** (HUD, scroll, menus) also only show state. User input becomes a call to an action, nothing more.

```text
input (swipe, pause button, timers)
        │
        ▼
    actions ──► stores ──► render (canvas, every frame)
                   │
                   └─────► DOM components (on change)
```

State flows one way. That makes the game testable without a browser, and a frame that looks wrong is always either wrong state or a wrong drawing of the right state, never both mixed together.

## Stores

A first cut. Split or merge as the code asks for it, but keep each one about one thing.

The run's stores:

| Store      | Holds                                                                                                                 | Example actions                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `run`      | Phase (`intro`, `running`, `ambush`, `paused`, `finished`, `fallen`), run time, world speed scale (slow-mo), distance, hold after an ambush | `start()`, `pause()`, `resume()`, `finish()`, `fall()`, `tick(delta)` |
| `quiz`     | The loaded quiz, question order, current index, answers given                                                         | `load(quiz)`, `next()`, `record(answer)`                           |
| `ambush`   | Current question, options with their marks, picks so far, time left                                                   | `open(question)`, `pick(mark)`, `commit()`, `tick(delta)`             |
| `score`    | Points, correct count, answered count, high score for this quiz                                                       | `addCorrect()`, `addMiss()`, `reset()`                             |
| `life`     | Life as a fraction of the error margin (see [life bar](../design/gameplay.md#life-bar))                               | `hit(share)`, `reset()`                                            |
| `shogun`   | Pose (`run`, `strike`, `block`, `hurt`, `fallen`), the target of a strike, when it started                            | `strike(ninjaId)`, `block(ninjaId)`, `hurt()`                      |
| `ninjas`   | Active ninjas: id, carried options, mark, position along the approach, pose                                           | `spawn(wave)`, `advance(approach)`, `slay(id)`, `clear()`                |

`createRunGame()` creates all of these together as one `RunGame`. Each store is a factory (`createLife(initial)`), so a test or a fixture can start it from any state.

The dojo reuses `quiz` and `ambush`. Practice adds a `tally` (right, wrong, missed) and has no life bar or score; study adds `reading` (card, playing, speech rate, spoken word).

App-wide:

| Store       | Holds                                              | Example actions                          |
| ----------- | -------------------------------------------------- | ---------------------------------------- |
| `settings`  | Difficulty (`timeScale`), haptics on/off, volume   | `setDifficulty(level)`, `setHaptics(on)` |
| `selection` | The quiz and stage chosen on the select screen     | `chooseQuiz(quiz)`, `chooseStage(stage)` |

Two more app-wide stores hold what outlives a run: `highScores` (per quiz `id` + `version`) and `lastRun` (the misses, for "practise mistakes"). A small `library` store holds the quizzes the player loaded.

Those, with `settings` and `selection`, are persisted by `_shared/storage/persistence.mts`, which `Application` starts before the first screen: it puts back what was saved and writes every change. Settings, the selection, high scores and the last run go in local storage through `@rooted/storage`. The selection keeps the quiz by `id` + `version` and chooses it again once the library has put it back; a stage that can't be chosen any more is dropped. The loaded quizzes go in IndexedDB as `.bunbu` files (`_shared/storage/quiz-files.mts`), a `.yaml` quiz packed when it is loaded: local storage holds about 5 MB, and the files are several times smaller than their YAML. The stores themselves know nothing of storage. Every value is wrapped in an envelope with the version of its shape, and what comes back is validated field by field (quiz files are validated again), so edited, old or broken data falls back to defaults. The rest of the state starts fresh with every run.

Choosing a quiz and running it share one route, `/fight/`: the select screen starts the run in its place, so a run can't be opened from a URL without a quiz. The run's stores are created when the player starts and dropped when they leave the run or the route. Pause, the results and the fallen screen are phases of the run, shown as overlays on it.

## A store

A store is a [`@rooted/store`](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/state.md) store inside a plain TypeScript module with no dependency on three.js or the DOM. `value` is a frozen snapshot, `update` merges what the setter returns, and `on('change', signal, …)` fires when the state really changed.

Each store is a factory, so a game mode creates its own and a test or fixture can start it from any state. The actions live on the state itself: `@rooted/store` keeps functions by reference when it snapshots, so `game.life.value.hit(share)` is how a flow changes the life bar. Nothing outside the store's own module calls `update`.

```ts
import { createStore, type Store } from '@rooted/store'

type LifeState = { readonly value: number }

type LifeActions = {
	hit: (share: number) => void
	reset: () => void
}

export type Life = Store<LifeState & LifeActions>

export function createLife(initial: LifeState = { value: 1 }): Life {
	const store: Life = createStore<LifeState & LifeActions>({
		...initial,

		hit(share) {
			store.update(() => ({ value: Math.max(0, store.value.value - share) }))
		},
		reset() {
			store.update(() => initial)
		},
	})
	return store
}
```

One workaround: `@rooted/store`'s `ReadonlyState` turns a branded string such as `Markdown` into an object type, so a quiz read back from a store is no longer a `BunbuData`. `snapshot()` in `_shared/state/store.mts` reads the quiz and the selection back as their own types.

Rules:

- **State is immutable.** An action returns the fields that change from `update` and never mutates the live state, and readers only see the frozen snapshot.
- **Actions are on the state.** A component or flow calls `store.value.action()`, never `update`.
- **Actions are synchronous** and do one thing. No promises inside stores: loading a quiz happens outside, and the result goes in through `quiz.load()`.
- **Invalid transitions are refused.** `ambush.pick()` while no ambush is open does nothing (and logs in dev builds). The phase is the guard, not the caller.
- **Stores don't import each other.** A store that needs to know about another is a sign the logic belongs in a flow (below).

## Flows: changes that span stores

One player action often touches several stores. Answering a question changes the ambush, the score or the life bar, the shogun and the ninjas. That orchestration goes in **flows**: plain functions that read stores and call their actions, in one place.

```ts
export function commitAmbush(game: RunGame) {
	const { ambush, quiz, score, life, shogun, run } = game
	const result = ambush.value.commit()
	if (!result) return

	quiz.value.record(result)
	if (result.outcome === 'correct') {
		score.value.addCorrect()
		for (const id of result.slain) shogun.value.strike(id)
	} else {
		life.value.hit(missShare(game))
		shogun.value.hurt()
	}
	if (life.value.empty()) run.value.fall()
}
```

Flows take the game mode's stores as an argument rather than importing them, so they work on whichever run is mounted. They are the only place where the game's rules meet. They stay free of three.js and the DOM, so they can be unit-tested with the stores.

## The game loop

One `requestAnimationFrame` loop drives everything. The `Application` starts it once; a route plugs its game mode into it with `play(mode, signal)`, which unplugs again when the route unmounts. Without a mode (on a menu) the loop only draws. Each frame, in a fixed order:

1. **Time.** Take the real frame delta, clamp it (a tab coming back from the background must not jump the run forward by minutes), and multiply it by the run's speed scale. That is how slow motion during an ambush works. The mode gets the real delta as well: slow motion is only visual, so timers the player plays against, such as the ambush's time limit, count real time.
2. **Update.** Call the time-based actions: `run.value.tick(worldDelta, realDelta)` first (distance by world time, capped at the next ambush; run time, countdown and the hold after an ambush by real time), so the run's clock has the frame in it when an ambush ends the run. Then `ambush.value.tick(realDelta)` with real time (held during the resume countdown) and `ninjas.value.advance(…)` from the time left. Last, once the samurai has recovered, the next ambush springs when he reaches it. Timeouts (the ambush running out) are decided here, by the stores, through flows.
3. **Render.** The renderer reads every store it needs through `value` and updates the scene: the shogun's position and animation clip, which ninjas exist and where they are, the camera. Then `renderer.render(scene, camera)`.

While paused, step 2 is skipped. The loop stops entirely when the page is hidden (`visibilitychange`) and restarts when it is visible again.

The renderer **polls** the stores every frame rather than subscribing, because it draws every frame anyway. DOM components **subscribe**, because they only need to change when the state does. A Rooted component passes its context's `signal` to `on`, so the listener is removed when the component unmounts:

```ts
onMount({ append, element, options, signal }) {
	const { game } = options
	const bar = append(
		element('div', {
			classes: styles.life,
		})
	)
	game.life.on('change', signal, ({ detail }) => {
		bar.style.setProperty('--life', String(detail.state.value))
	})
}
```

## What the renderer may keep

"No logic in the canvas" means no game logic. The renderer still keeps **visual state** that is derived from the stores and never fed back:

- the three.js objects themselves, and a map from store ids (ninja id) to meshes;
- animation mixers and cross-fades between clips;
- easing and interpolation, such as smoothing the camera;
- particles, slash trails and other effects.

Two rules keep this honest:

- **The stores decide timing.** A strike lasts as long as the state says (for example `shogun.strike` stores when it started, and the flow knows its duration). The renderer fits the animation to that time. It never tells the game an animation has finished.
- **One-off events are state.** A slash, a hit or a block is recorded in the store with the time it started (or a sequence number). The renderer sees a new one and starts the effect. There is no event bus between game and renderer.

If the canvas were removed, the game would still play correctly to the end; you just wouldn't see it. That is the test for whether something belongs in a store or in the renderer.

## Testing

Stores and flows are plain TypeScript, so they are tested without a browser: create the stores, call actions and flows, tick the clock by hand, and assert on `value`. For example: an ambush with 5 seconds that is ticked for 6 seconds without a pick ends as unanswered, takes the question's share off the life bar, and scores 0.

## Folder layout

The game follows Rooted's [vertical slices](https://github.com/Marvin-Brouwer/rooted/blob/main/docs/guide/application-model.md): one folder per feature, holding its routes, screens, styles, state and rules.

```text
apps/game/src/
	application.mts   the Application: the canvas, the loop and the router
	canvas/           the game loop (play() plugs a mode in), the viewport, show() for a world
	_shared/          what several slices use
		state/        quiz, ambush, selection, snapshot()
	_temp/            the fixture quiz, until quizzes load for real
	title/            the title menu (the router's home) and not-found
	fight/            /fight/: quiz select, then the run
		state/        the run's stores and createRunGame
		flows/        functions that span the run's stores
		world.mts     the run's 3D world (reads state only)
		_temp/        dev-only run states (fixtures.mts), through `/fight/?fixture=<name>`
	dojo/             /dojo/, /dojo/study/, /dojo/practice/
		state/        createPracticeGame, createStudyGame
	settings/         /settings/
		state/        the settings store
```

Every `_routes.mts` is collected into the generated `_routes.g.mts` at build time, so adding a slice never touches `application.mts`.

A slice's `state/` and `flows/` only import from other `state/` and `flows/` folders: never a component, the canvas, three.js or the DOM. oxlint enforces that (`oxlint.config.ts`).
