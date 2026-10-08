# Game state

How the game keeps its state, who may change it, and how the screen follows it. The screen itself (one three.js canvas with Rooted components on top) is described in [rendering.md](rendering.md).

## The idea

- The game state lives in **several small stores**, one per concern: the run, the score, the life bar, the shogun, the ninjas, the current ambush.
- Each **game mode** (the run, dojo practice, dojo study) has its own set of stores. Its route creates them when it mounts and drops them when it unmounts, so nothing carries over from one run to the next or into the dojo.
- Only **settings** and the **selection** (the chosen quiz and stage) are app-wide. Moving between screens is routing ([@rooted/router](https://www.npmjs.com/package/@rooted/router)), not state.
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
| `run`      | Phase (`intro`, `running`, `ambush`, `paused`, `finished`, `fallen`), run time, world speed scale (slow-mo), distance | `start()`, `pause()`, `resume()`, `finish()`, `fall()`, `tick(dt)` |
| `quiz`     | The loaded quiz, question order, current index, answers given                                                         | `load(quiz)`, `next()`, `record(answer)`                           |
| `ambush`   | Current question, options with their marks, picks so far, time left                                                   | `open(question)`, `pick(mark)`, `commit()`, `tick(dt)`             |
| `score`    | Points, correct count, answered count, high score for this quiz                                                       | `addCorrect()`, `addMiss()`, `reset()`                             |
| `life`     | Life as a fraction of the error margin (see [life bar](../design/gameplay.md#life-bar))                               | `hit(share)`, `reset()`                                            |
| `shogun`   | Pose (`run`, `strike`, `block`, `hurt`, `fallen`), the target of a strike, when it started                            | `strike(ninjaId)`, `block(ninjaId)`, `hurt()`                      |
| `ninjas`   | Active ninjas: id, carried options, mark, position along the approach, pose                                           | `spawn(wave)`, `advance(dt)`, `slay(id)`, `clear()`                |

`createRunGame()` creates all of these together as one `RunGame`. Each store is a factory (`createLife(initial)`), so a test or a fixture can start it from any state.

The dojo reuses `quiz` and `ambush`. Practice adds a `tally` (right, wrong, missed) and has no life bar or score; study adds `reading` (card, playing, speech rate, spoken word).

App-wide:

| Store       | Holds                                              | Example actions                          |
| ----------- | -------------------------------------------------- | ---------------------------------------- |
| `settings`  | Difficulty (`timeScale`), haptics on/off, volume   | `setDifficulty(level)`, `setHaptics(on)` |
| `selection` | The quiz and stage chosen on the select screen     | `chooseQuiz(quiz)`, `chooseStage(stage)` |

`settings` is the only store that is persisted (local storage), together with the high scores. The rest starts fresh with every run.

Choosing a quiz and running it share one route, `/fight/`: the select screen starts the run in its place, so a run can't be opened from a URL without a quiz. The run's stores are created when the player starts and dropped when they leave the run or the route. Pause, the results and the fallen screen are phases of the run, shown as overlays on it.

## A store

A store is a plain TypeScript module with no dependency on three.js or the DOM. A sketch of the shape, not a final API:

```ts
type Listener<TState> = (state: TState, previous: TState) => void;

export function createStore<TState extends object>(initial: TState) {
  let state = initial;
  const listeners = new Set<Listener<TState>>();

  return {
    get: (): Readonly<TState> => state,
    set(next: TState) {
      if (next === state) return;
      const previous = state;
      state = next;
      for (const listener of listeners) listener(state, previous);
    },
    subscribe(listener: Listener<TState>, signal: AbortSignal) {
      listeners.add(listener);
      signal.addEventListener("abort", () => listeners.delete(listener), {
        once: true,
      });
    },
  };
}
```

The store module exports only its reader and its actions, never `set`:

```ts
type LifeState = { readonly value: number };

const store = createStore<LifeState>({ value: 1 });

export const life = {
  get: store.get,
  subscribe: store.subscribe,
  hit(share: number) {
    store.set({ value: Math.max(0, store.get().value - share) });
  },
  reset() {
    store.set({ value: 1 });
  },
};
```

Rules:

- **State is immutable.** An action replaces the state object rather than mutating it, so `previous` in a listener is reliable and a component can compare by reference.
- **Actions are synchronous** and do one thing. No promises inside stores: loading a quiz happens outside, and the result goes in through `quiz.load()`.
- **Invalid transitions are refused.** `ambush.pick()` while no ambush is open does nothing (and logs in dev builds). The phase is the guard, not the caller.
- **Stores don't import each other.** A store that needs to know about another is a sign the logic belongs in a flow (below).

## Flows: changes that span stores

One player action often touches several stores. Answering a question changes the ambush, the score or the life bar, the shogun and the ninjas. That orchestration goes in **flows**: plain functions that read stores and call their actions, in one place.

```ts
export function commitAmbush({ ambush, quiz, score, life, shogun, run }: RunGame) {
  const result = ambush.commit();
  if (!result) return;

  quiz.record(result.answer);
  if (result.correct) {
    score.addCorrect();
    for (const id of result.slain) shogun.strike(id);
  } else {
    life.hit(result.share);
    shogun.hurt();
  }
  if (life.get().value === 0) run.fall();
}
```

Flows take the game mode's stores as an argument rather than importing them, so they work on whichever run is mounted. They are the only place where the game's rules meet. They stay free of three.js and the DOM, so they can be unit-tested with the stores.

## The game loop

One `requestAnimationFrame` loop drives everything. The app shell starts it once; a route plugs its game mode into it with `play(mode, signal)`, which unplugs again when the route unmounts. Without a mode (on a menu) the loop only draws. Each frame, in a fixed order:

1. **Time.** Take the real frame delta, clamp it (a tab coming back from the background must not jump the run forward by minutes), and multiply it by the run's speed scale. That is how slow motion during an ambush works.
2. **Update.** Call the time-based actions: `run.tick(dt)`, `ambush.tick(dt)`, `ninjas.advance(dt)`. Timeouts (the ambush running out) are decided here, by the stores, through flows.
3. **Render.** The renderer reads every store it needs with `get()` and updates the scene: the shogun's position and animation clip, which ninjas exist and where they are, the camera. Then `renderer.render(scene, camera)`.

While paused, step 2 is skipped. The loop stops entirely when the page is hidden (`visibilitychange`) and restarts when it is visible again.

The renderer **polls** the stores every frame rather than subscribing, because it draws every frame anyway. DOM components **subscribe**, because they only need to change when the state does. A Rooted component passes its context's `signal` to `subscribe`, so the listener is removed when the component unmounts:

```ts
onMount({ signal, element, append }) {
	const bar = append(element('div', { className: 'life' }))
	life.subscribe(({ value }) => bar.style.setProperty('--life', String(value)), signal)
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

Stores and flows are plain TypeScript, so they are tested without a browser: create the stores, call actions and flows, tick the clock by hand, and assert on `get()`. For example: an ambush with 5 seconds that is ticked for 6 seconds without a pick ends as unanswered, takes the question's share off the life bar, and scores 0.

## Folder layout

```text
apps/game/src/
	application.mts   the router, mounted inside the shell
	state/            createStore, the stores shared by modes (quiz, ambush), settings, selection
		run/          the run's stores and createRunGame
		practice/     dojo practice: createPracticeGame
		study/        dojo study: createStudyGame
	flows/run/        functions that span the run's stores
	loop.mts          the game loop: time, update, render; play() plugs a mode in
	render/           viewport, stage (show() puts a view on the canvas), one folder per mode's world
	ui/               Rooted components, one folder per screen
		shell/        the canvas and the routed screen on top of it
		<screen>/     _routes.mts registers the screen's routes; the screen lazy-loads
	fixtures/         dev-only run states per screen, through `/fight/?fixture=<name>`
```

Every `_routes.mts` is collected into the generated `_routes.g.mts` at build time, so adding a screen never touches `application.mts`.

`render/` and `ui/` may import from `state/`. `state/` and `flows/` never import from `render/` or `ui/`. eslint enforces that, and keeps browser globals out of them.
