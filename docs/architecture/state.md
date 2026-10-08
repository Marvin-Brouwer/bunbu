# Game state

How the game keeps its state, who may change it, and how the screen follows it. The screen itself (one three.js canvas with Rooted components on top) is described in [rendering.md](rendering.md).

## The idea

- The game state lives in **several small stores**, one per concern: the run, the score, the life bar, the shogun, the ninjas, the current ambush, the settings.
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

| Store      | Holds                                                                                                                 | Example actions                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `run`      | Phase (`intro`, `running`, `ambush`, `paused`, `finished`, `fallen`), run time, world speed scale (slow-mo), distance | `start()`, `pause()`, `resume()`, `finish()`, `fall()`, `tick(dt)` |
| `quiz`     | The loaded quiz, question order, current index, answers given                                                         | `load(quiz)`, `next()`, `record(answer)`                           |
| `ambush`   | Current question, options with their marks, picks so far, time left                                                   | `open(question)`, `pick(mark)`, `commit()`, `tick(dt)`             |
| `score`    | Points, correct count, answered count, high score for this quiz                                                       | `addCorrect()`, `addMiss()`, `reset()`                             |
| `life`     | Life as a fraction of the error margin (see [life bar](../design/gameplay.md#life-bar))                               | `hit(share)`, `reset()`                                            |
| `shogun`   | Pose (`run`, `strike`, `block`, `hurt`, `fallen`), the target of a strike, when it started                            | `strike(ninjaId)`, `block(ninjaId)`, `hurt()`                      |
| `ninjas`   | Active ninjas: id, carried options, mark, position along the approach, pose                                           | `spawn(wave)`, `advance(dt)`, `slay(id)`, `clear()`                |
| `settings` | Difficulty (`timeScale`), haptics on/off, volume                                                                      | `setDifficulty(level)`, `setHaptics(on)`                           |

`settings` is the only store that is persisted (local storage), together with the high scores. The rest starts fresh with every run.

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
export function commitAmbush() {
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

Flows are the only place where the game's rules meet. They stay free of three.js and the DOM, so they can be unit-tested with the stores.

## The game loop

One `requestAnimationFrame` loop drives everything, in a fixed order each frame:

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
	state/      one module per store, plus createStore
	flows/      functions that span stores
	loop.mts    the game loop: time, update, render
	render/     three.js scene, renderer, asset loading (reads state only)
	ui/         Rooted components: HUD, scroll, swipe zone, menus
	fixtures/   dev-only store states per screen, through `?fixture=<name>`
```

`render/` and `ui/` may import from `state/`. `state/` and `flows/` never import from `render/` or `ui/`. An eslint import rule can enforce that.
