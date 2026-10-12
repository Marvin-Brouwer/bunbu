# Gameplay

How a run plays out: the auto-runner, the ambush that asks each question, the life bar and the score. Quiz content comes from the [data format](data-format.md). The screens that show all of this are in [screens.md](screens.md), the risk-free training mode in [dojo.md](dojo.md).

## Platform

- **Mobile first**, phone portrait (wireframes are drawn at 390×844). Landscape was rejected as the target layout.
- Don't hard-constrain the orientation, and don't build anything that blocks desktop for now. That is for later.

## Tech

- The website is built with [Rooted](https://www.npmjs.com/package/@rooted/components) (`@rooted/components`).
- 3D elements use three.js with GLB models. Where they come from, and the license rules, is in [assets.md](assets.md).
- Use web-based controls (Rooted components over the canvas) wherever possible, rather than drawing UI inside the 3D canvas. The canvas is for the world: the samurai, the ninjas, the stage.
- How the screen is layered (one canvas, DOM on top) is in [rendering.md](../architecture/rendering.md). How game state is kept and drawn is in [state.md](../architecture/state.md).

## Core loop

The samurai always runs down the centre of the path at a constant pace: the game never speeds up, however long the quiz is. There are no lanes and no gameplay input while running. The only control is a pause button, which leads to the [pause menu](screens.md#6-pause) (resume, restart, settings, quit).

Each question in the quiz triggers an **ambush**: ninjas attack, a papyrus scroll shows the question, and the player answers with a swipe. A right answer slays (or blocks) the ninjas, a wrong one gets the samurai hit. After the ambush the run resumes.

The run ends when the stage is cleared ([results](screens.md#7-finished-results-and-mistakes)) or when the pass mark is out of reach ([fallen](screens.md#8-fallen)).

## Ambush

One screen, no Submit button: **the swipe is the answer**.

1. The world freezes into slow motion. The ninjas run into view, one briefly winding up for a cut before the answer appears.
2. The scroll opens down to the bottom of the screen with the query and any code; the question has the whole scroll and scrolls when it is long.
3. The answers are in the **answer drawer** at the foot of the scroll. Closed, only its edge shows, with a red seal (a hanko stamped 答, "answer") and "Tap or swipe up to answer" above it. Tapping the seal or swiping it up draws the answers up over the whole scroll, the same swipe area for every question; swiping it down puts them away to read the question again.
4. Every option is tagged with a **mark**: the swipe direction (← ↑ → …) of the ninja carrying it. The drawn answers are the **swipe zone**: swiping toward a mark picks that option. Only swipes on the answers count, so the question can be scrolled freely.
5. The scroll rolls up, slow motion snaps back to full speed, and the slashes and blocks play.

The answers are written in ink on lined paper, one per line with the arrow of its mark in front; the drawer shows no ninjas. Above them is one brush-lettered line on how to answer. Only the swipe zone blocks text selection; the question can be selected. The finger leaves a faint trace on the paper, and a pick cuts its answer in two: the line splits along the cut, leaning with the swipe, with a thin red edge between the halves. For `order` the place it was cut in is brushed next to it. The ambush is about the answers: the real ninjas creep in, in 3D, below the scroll (see [time limit](#time-limit)), and what happens to them follows the answer.

<img src="screens/4a-single.png" alt="Single-answer ambush" width="195"> <img src="screens/4c-multiple.png" alt="Multiple-answer ambush" width="195">

### Per question type

| Type        | Ninjas                      | Input                                                                                   |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `yes-no`    | 1                           | One swipe: ↑ yes (slash), ↓ no (block).                                                 |
| `single`    | one per option              | One swipe toward the chosen option's mark.                                              |
| `multiple`  | one per option              | Swipe toward each mark to pick it. Lifting between swipes is optional: ← lift → and one continuous ← → stroke both pick two marks. A pause of 0.8 s after lifting strikes. A swipe is final: swiping a marked mark again does nothing. |
| `order`     | one per item                | As `multiple`; the marks get numbers 1, 2, 3 … in swipe order.                          |
| `solutions` | 1 per proposed solution     | One scroll per solution, answered like `yes-no` ("2 of 3" on the scroll).               |
| `match`     | one per option              | One `single`-style scroll per row.                                                      |

The solutions of a `solutions` question and the rows of a `match` are **rounds of one ambush**: the ninjas attack once, and the scrolls come one after another. When a scroll is answered it rolls up and the next one unrolls; the ninjas keep closing in, and the samurai stands his ground. A wrong round still costs a hit: the samurai is hit, and the life bar loses what the miss costs (see [life bar](#life-bar)). The outcome plays out after the last round, by its answer. When the time runs out, the round on the scroll and every round still to come are unanswered, for one hit.

### Outcome

Each ninja carries one option. A **slash** means "this option is picked", a **block** means "not picked". The answer is correct when every slash lands on a correct option and every block on an incorrect one. The same rule covers `yes-no` and `solutions`.

- **Correct:** the samurai deals with the ninjas one after another: he slays the picked ones and blocks the others, which are knocked back and flee. `+100` pops up (see [score](#score)). He holds for about half a second after the first one, plus a beat for each ninja after it, then runs on.
- **Wrong:** a ninja lands the hit with a katana slice and blood spray, and all of them vanish. The lost chunk flashes and drops off the life bar, with a haptic buzz (haptics can be turned off in the settings). No answer is shown and nothing needs tapping: after about 1 s the run resumes. The miss is saved for the review at the end.
- **Unanswered:** time ran out. The front ninja slices through the scroll, then all of them hit, which still counts as one hit. Costs the same as a wrong answer. Half-swiped answers do not count. Saved for the review as "unanswered".

### More than 3 options

- Up to **5 ninjas**: 3 in front, 2 behind. One scroll, one answer, then they strike in 2 waves (front, then back; the back row is drawn faded).
- One swipe direction per option, **8 directions** in total: ← ↖ ↑ ↗ → ↘ ↓ ↙. So an ambush shows **at most 8 options**. This limits the fight, not the quiz format: with more options, distractors are dropped at random (a different set each time) until 8 are left. A question with more than 8 correct options (or `order` items) can't be fought. Loading a quiz warns about questions that will be truncated, that give the answer away with only one option, and about the ones that can't be played.
- With **6 or more options**, the options are shuffled and then bundled at random onto the 5 ninjas (7 options = 1, 2, 2, 1, 1). Every option keeps its own swipe. A bundled ninja is only handled right if all its options are.

<img src="screens/4d-many-options.png" alt="7 options bundled onto 5 ninjas" width="195">

## Time limit

There is no timer bar: the ambush opens in slow motion and **the ninjas creeping in are the timer**.

On a phone in portrait the scroll covers the whole width, so the ninjas have to be shown:

- **Room below the scroll.** When the screen is tall enough, the scroll stops short of the bottom (at most a fifth of the screen, and only while the scroll keeps room to read). During the ambush the camera frames the fight in that room: the samurai near the bottom edge, the ninjas running in from just under the scroll. When the scroll rolls up, the view eases back.
- **The duel strip.** A low strip between the HUD's top row and the scroll shows the samurai and a ninja as silhouettes against the sky, walking toward each other as the ninjas close in. They meet in the middle when the time is up. It shows on every phone in portrait, and is all there is when the screen is too short for the room below.

Wider than the scroll (a tablet, landscape), the world shows beside it and needs neither.

When the quiz sets [`timePerQuestion`](data-format.md#document-structure), that is the time of the ambush, all its rounds together (the rows of a `match`, the solutions of a `solutions`):

```text
ambushSeconds = timePerQuestion × timeScale
```

Without it, the time is worked out from the question:

```text
ambushSeconds = ceil(read + answer) × timeScale, minimum 5 s
read          = words / 200 wpm (words in code count double)
answer        = yes-no:    1.5
                single:    1 + 0.75 per option
                multiple:  1 + 1.25 per option
                order:     1 + 1.5 per item
```

`solutions` and `match` use the `yes-no` and `single` rows, per solution or row, added up for the whole ambush. A round answered early leaves its time to the ones after it. The pause between two scrolls doesn't count.

`timeScale` is the difficulty, a slider with four stops, the two inner ones marked on the track: **Apprentice** `1.2`, **Samurai** `1` (where a new player starts), **Daimyo** `0.8` and **Shogun** `0.5`. The dojo has no time limit.

All of these numbers are defaults. Make them configurable and tune them in playtests, including the 0.8 s commit pause.

## Life bar

No hearts. The life bar shows **only the error margin**: full is 100%, empty is the quiz `passingScore`. With a 70% pass mark, the bar runs from 1.0 down to 0.7, so the player never gets a false sense of security. There is no pass marker on the bar.

```text
life = (best score still possible − pass) / (1 − pass)
```

- Points as in the data format: each question is 1 point, each `solutions` entry is 1 point.
- Each miss takes its question's share for good. Any error in a question costs the whole share, however many ninjas or errors were involved. Example: 20 points with a 70% pass mark leaves a margin of 6 points, so one miss takes a sixth of the bar.
- An empty bar means the quiz can no longer be passed: the samurai falls ([screen 8](screens.md#8-fallen)).

<img src="screens/5b-wrong.png" alt="Wrong answer: life bar drops" width="195"> <img src="screens/8-fallen.png" alt="Fallen" width="195">

## Score

No rank ladder, no honour, no streaks. What counts is how many you got right, then how fast.

```text
per correct question = 100
wrong or unanswered  = 0
```

There is no per-question speed bonus: with hundreds of questions it would reward rushing every one of them. Time is shown instead: the total run time is on the results screen and next to the high score (`17 / 20 correct · 4:05`), so runs can be compared, and with equal scores the shorter run time wins the high score. A 20-question quiz maxes out at 2,000.

- The high score is kept **per quiz** (`id` + `version`).
- Only a passed run sets a high score. A fallen run shows its score but does not count.
- Shown as: running score with the best to beat in the HUD, high score on the menu and the quiz cards, a "new high score" header on the results.

## Review

A wrong answer is never explained during the run. Every miss is reviewed at the end, finished or fallen, on a scroll with a scrollbar: the question, your pick, the right answer, the option and question `explanation`, and `references`.

## Reading aloud

There is no speaker button in the main game. Reading aloud is a learning aid and lives in the [dojo](dojo.md).

## To tune

- **Playtest defaults:** the timer numbers, `timeScale` values and the 0.8 s commit pause.
- **On a real phone:** how far a swipe has to go and how sharp a turn starts the next one (`swipeConfig` in the swipe zone).
