# Gameplay

How a run plays out: the auto-runner, the ambush that asks each question, the life bar and the score. Quiz content comes from the [data format](data-format.md). The screens that show all of this are in [screens.md](screens.md), the risk-free training mode in [dojo.md](dojo.md).

## Platform

- **Mobile first**, phone portrait (wireframes are drawn at 390×844). Landscape was rejected as the target layout.
- Don't hard-constrain the orientation, and don't build anything that blocks desktop for now. That is for later.

## Tech

- The website is built with [Rooted](https://www.npmjs.com/package/@rooted/components) (`@rooted/components`).
- 3D elements use three.js with GLB models.
- Use web-based controls (Rooted components over the canvas) wherever possible, rather than drawing UI inside the 3D canvas. The canvas is for the world: the samurai, the ninjas, the stage.

## Core loop

The samurai always runs down the centre of the path. There are no lanes and no gameplay input while running. The only control is a pause button, which leads to the [pause menu](screens.md#6-pause) (resume, restart, settings, quit).

Each question in the quiz triggers an **ambush**: ninjas attack, a papyrus scroll shows the question, and the player answers with a swipe. A right answer slays (or blocks) the ninjas, a wrong one gets the samurai hit. After the ambush the run resumes.

The run ends when the stage is cleared ([results](screens.md#7-finished-results-and-mistakes)) or when the pass mark is out of reach ([fallen](screens.md#8-fallen)).

## Ambush

One screen, no Draw or Submit button: **the swipe is the answer**.

1. The world freezes into slow motion. The scroll opens and fills the top of the screen with the query, any code, and the options.
2. Every option is tagged with a **mark**: the swipe direction (← ↑ → …) of the ninja carrying it.
3. The bottom of the screen is the **swipe zone**. Swiping toward a mark picks that option. Only swipes in this zone count, so the scroll text above can be scrolled freely.
4. The scroll rolls up, slow motion snaps back to full speed, and the slashes and blocks play.

The ninja figures in the swipe zone are only a legend for the marks. The real ninjas creep in, in 3D, behind the scroll (see [time limit](#time-limit)).

### Per question type

| Type        | Ninjas                      | Input                                                                                   |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `yes-no`    | 1                           | One swipe: ↑ yes (slash), ↓ no (block).                                                 |
| `single`    | one per option              | One swipe toward the chosen option's mark.                                              |
| `multiple`  | one per option              | Swipe toward each mark to pick it. Lifting between swipes is optional: ← lift → and one continuous ← → stroke both pick two marks. A pause of 0.8 s after lifting strikes. Swiping a marked mark again unmarks it. |
| `order`     | one per item                | As `multiple`; the marks get numbers 1, 2, 3 … in swipe order.                          |
| `solutions` | 1 per proposed solution     | One ambush per solution, answered like `yes-no` ("2 of 3" on the scroll).               |
| `match`     | one per option              | One `single`-style ambush per row.                                                      |

### Outcome

Each ninja carries one option. A **slash** means "this option is picked", a **block** means "not picked". The answer is correct when every slash lands on a correct option and every block on an incorrect one. The same rule covers `yes-no` and `solutions`.

- **Correct:** picked ninjas are slain, the others are blocked, knocked back and flee. `+100` pops up (see [score](#score)).
- **Wrong:** a ninja lands the hit and all of them vanish. The lost chunk flashes and drops off the life bar, with a red edge flash and a haptic buzz (haptics can be turned off in the settings). No answer is shown and nothing needs tapping: after about 1 s the run resumes. The miss is saved for the review at the end.
- **Unanswered:** time ran out. The front ninja slices through the scroll, then all of them hit, which still counts as one hit. Costs the same as a wrong answer. Half-swiped answers do not count. Saved for the review as "unanswered".

### More than 3 options

- Up to **5 ninjas**: 3 in front, 2 behind. One scroll, one answer, then they strike in 2 waves (front, then back; the back row is drawn faded).
- One swipe direction per option, **8 directions** in total: ← ↖ ↑ ↗ → ↘ ↓ ↙.
- With **6 or more options**, the options are shuffled and then bundled at random onto the 5 ninjas (7 options = 1, 2, 2, 1, 1). Every option keeps its own swipe. A bundled ninja is only handled right if all its options are.

## Time limit

There is no timer bar: the ambush opens in slow motion and **the ninjas creeping in are the timer**.

```text
ambushSeconds = ceil(read + answer) × timeScale, minimum 5 s
read          = words / 200 wpm (words in code count double)
answer        = yes-no:    1.5
                single:    1 + 0.75 per option
                multiple:  1 + 1.25 per option
                order:     1 + 1.5 per item
```

`solutions` and `match` use the `yes-no` and `single` rows, per solution or row.

`timeScale` is a setting: `1`, relaxed `1.5`, or `off`.

All of these numbers are defaults. Make them configurable and tune them in playtests, including the 0.8 s commit pause.

## Life bar

No hearts. The life bar shows **only the error margin**: full is 100%, empty is the quiz `passingScore`. With a 70% pass mark, the bar runs from 1.0 down to 0.7, so the player never gets a false sense of security. There is no pass marker on the bar.

```text
life = (best score still possible − pass) / (1 − pass)
```

- Points as in the data format: each question is 1 point, each `solutions` entry is 1 point.
- Each miss takes its question's share for good. Any error in a question costs the whole share, however many ninjas or errors were involved. Example: 20 points with a 70% pass mark leaves a margin of 6 points, so one miss takes a sixth of the bar.
- An empty bar means the quiz can no longer be passed: the samurai falls ([screen 8](screens.md#8-fallen)).

## Score

No rank ladder, no honour, no streaks. What counts is how many you got right, then how fast.

```text
per correct question = 100
wrong or unanswered  = 0
```

There is no per-question speed bonus: with hundreds of questions it would reward rushing every one of them. Speed only breaks ties: with equal scores, the shorter total run time wins the high score. A 20-question quiz maxes out at 2,000.

- The high score is kept **per quiz** (`id` + `version`).
- Only a passed run sets a high score. A fallen run shows its score but does not count.
- Shown as: running score with the best to beat in the HUD, high score on the menu and the quiz cards, a "new high score" header on the results.

## Review

A wrong answer is never explained during the run. Every miss is reviewed at the end, finished or fallen, on a scroll with a scrollbar: the question, your pick, the right answer, the option and question `explanation`, and `references`.

## Reading aloud

There is no speaker button in the main game. Reading aloud is a learning aid and lives in the [dojo](dojo.md).

## Open questions

- **More than 8 options:** there are no swipe directions left.
- **`scoring: partial`:** the data format lets a question earn part of its point, but the life bar takes a question's whole share on any error. Decide whether partial scoring affects the life bar, the score, or neither.
- **Defaults still to tune in playtests:** the timer numbers, `timeScale` values and the 0.8 s commit pause.
