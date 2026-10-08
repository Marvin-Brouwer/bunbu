# Rendering layout

How the screen is put together: one three.js canvas for the world, with Rooted components on top for everything you read or touch. Game state and the game loop are in [state.md](state.md). What the world looks like is in [gameplay.md](../design/gameplay.md) and [assets.md](../design/assets.md).

## Decision

**One WebGL canvas for all 3D, and DOM for all UI.**

- The stage, the ninjas and the shogun are all in **one** three.js scene, drawn by **one** `WebGLRenderer` into **one** `<canvas>`.
- The scroll, the HUD, the swipe zone, menus and results are Rooted (`@rooted/components`) components layered over that canvas.

There is no canvas per concern (scene, ninjas, shogun, scroll).

## Why not several canvases

- **Occlusion needs one depth buffer.** A ninja has to be able to stand behind a tree, step in front of the shogun, or be hidden by a rock. That only works when everything is drawn into the same depth buffer. Separate canvases are just stacked images: whatever canvas is on top always wins.
- **One camera, one set of lights.** Separate canvases each need their own camera and lights, kept in sync by hand every frame. Any drift shows as characters sliding against the ground or lit differently from the world they stand in.
- **WebGL contexts are expensive and limited.** Each canvas is its own context with its own copies of shaders, textures and buffers on the GPU. Mobile browsers cap the number of live contexts per page (and drop the oldest when you go over), and each extra context adds compositing work for the browser on every frame. Phones are the main target.
- **Shared assets.** One context means a texture or geometry is uploaded once and shared by every mesh that uses it.

## Why the UI is DOM

- The scroll shows text, code and option marks. The browser does that better than a canvas: crisp fonts at any pixel ratio, text selection where wanted, native scrolling of long questions, Markdown rendered to real HTML, accessibility, and CSS animation for the unroll and roll-up.
- It matches the [tech rule](../design/gameplay.md#tech) to prefer web controls over drawing UI in the canvas.
- UI changes don't cost GPU draw calls on the canvas, and the canvas never has to redraw because a label changed.

## Layers

From back to front:

| Layer           | What                                                      | Input                         |
| --------------- | --------------------------------------------------------- | ----------------------------- |
| Backdrop (opt.) | CSS background behind the canvas, such as an ink-wash sky | none                          |
| World canvas    | three.js: stage, props, shogun, ninjas, effects           | none (`pointer-events: none`) |
| HUD             | Life bar, score, pause button                             | pause button only             |
| Scroll          | Papyrus scroll with query, code and options               | scrolls its own text          |
| Swipe zone      | Bottom strip during an ambush, with the mark legend       | swipes                        |
| Overlays        | Pause menu, results, fallen screen, settings              | full                          |

All layers are siblings in one fixed, full-viewport container, stacked with `z-index`. The canvas fills the container and resizes with it.

The `Application` component (`application.mts`) owns the container, the canvas and the renderer, and mounts once. The router renders the current screen over the canvas, so moving between screens never creates a new WebGL context. A screen puts its world on the canvas with `show(view, signal)` and the view is disposed when the screen unmounts; on a screen without a view the canvas is clear and the backdrop shows. The run's screen holds the HUD, scroll, swipe and overlay layers.

The ninjas creeping in "behind the scroll" during an ambush needs nothing special: they are in the 3D world, the scroll is DOM above the canvas, so they are always under it. Where the scroll is transparent (its torn edges, gaps around it) you see them coming.

## Renderer setup

```ts
const renderer = new WebGLRenderer({
  canvas,
  alpha: true, // transparent canvas, so a CSS backdrop can show through
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

- **Pixel ratio is capped at 2.** Phones report 3 or more, which roughly doubles the pixels to shade for little visible gain.
- **Resize** from a `ResizeObserver` on the container: update the renderer size and the camera aspect. Portrait is the target, but the layout must not break in landscape or on desktop (see [platform](../design/gameplay.md#platform)).
- **`alpha: true` is only needed when there is a CSS backdrop.** If the sky ends up as part of the 3D scene, use `alpha: false`: it is a little cheaper and avoids the caveat below.

### Premultiplied alpha caveat

With `alpha: true` the browser composites the canvas over the page using **premultiplied** alpha (three.js's default `premultipliedAlpha: true`). Colours with partial alpha that are not premultiplied come out wrong over the page: semi-transparent edges (alpha-tested foliage, soft particles, anti-aliased silhouettes) show a dark fringe, or a light halo over a dark backdrop.

To avoid it:

- Keep the clear colour fully transparent black (`setClearColor(0x000000, 0)`), never a colour with alpha 0.
- For transparent materials and textures, set `premultipliedAlpha: true` on the material, or prefer `alphaTest` cut-outs for foliage over blended edges.
- Check edges against the actual backdrop on a real phone, not only against white.

## Layering inside the canvas

When something in the world must be drawn in a fixed order, do it inside the one canvas:

- **`renderOrder`** on meshes or groups, for transparent things that sort wrongly (smoke, slash trails, the ink splash).
- **Two passes** when something must always be on top of the world regardless of depth, such as a slash effect across the screen: set `renderer.autoClear = false`, render the world scene, call `renderer.clearDepth()`, then render the effects scene with the same camera.
- **Layers** (`Object3D.layers`) to include or exclude objects from a pass, rather than keeping separate scenes in sync.

All of these share the same context, camera and assets.

## Rendering is read-only

The canvas only draws what the game state says. It holds no rules, timers or scores, and it never changes state. On every frame of the game loop it reads the stores and updates the scene graph to match. See [state.md](state.md) for how that works.
