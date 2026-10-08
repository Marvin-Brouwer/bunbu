# Screens

The screens from the low-fi wireframes (phone portrait, 390×844). The rules behind them are in [gameplay.md](gameplay.md) and [dojo.md](dojo.md).

Wireframe source: the project's design canvas (`design/wireframes/*.dc.html` and `canvas.json` in the project files).

## Flow

```text
1 Title ──► 2 Quiz + stage ──► 3 Running ──► 4 Ambush ──► 5 Outcome ──► 3 Running …
   │                              │                                   │
   │                              └─► 6 Pause                         ├─► 7 Finished
   │                                                                  └─► 8 Fallen
   └─► D1 Dojo ──► D2 Study
              └──► D3 Practice start ──► D4 Practice ambush ──► D5 Practice miss
```

## Main game

### 1 Title / menu

- 3D samurai idling under a torii, falling petals.
- 文武 · **Bunbu** · Shogun Scholar.
- High score for the last quiz: `2,480`, with `17 / 20 correct · 4:05`.
- **Run** (shows the current quiz and stage), **Quiz and stage**, **Dojo**, **Settings**.

### 2 Quiz + stage

"Choose your path":

1. **Quiz:** cards with title, `version`, pass mark and best score (`v3 · pass 70% · best 2,480`, or `new`), plus **Load .yaml**.
2. **Stage:** Rice fields, Bamboo forest, Mountain temple, Castle town, Edo castle. Each shows its best distance and whether it was cleared.

A Novice / Adept / Master selector (sets `timeScale`, see [time limit](gameplay.md#time-limit)) and **Start run**.

### 3 Running

- 3D samurai, always centred, auto-running toward a torii. No input until an ambush.
- HUD: **score** with best to beat, **life bar** (full = 100%, empty = the pass mark), and a **pause** button.
- Progress bar: stage name and distance (`860 / 1,500 m`). Ticks mark ambushes, a block marks the boss.

### 4 Ambush

All variants: the scroll on top, the swipe zone with the mark legend at the bottom, slow motion, no timer bar. See [ambush](gameplay.md#ambush).

- **4A single:** `AMBUSH · SINGLE · 3 NINJAS`, options on ← ↑ →, "swipe here".
- **4B solutions / yes-no:** `AMBUSH · SOLUTIONS · 2 OF 3`, scenario on the scroll, one ninja, ↑ yes (slash) / ↓ no (block).
- **4C multiple / order:** `AMBUSH · MULTIPLE · CHOOSE 2`. Marked options show `MARKED`. Hint: "lift + pause 0.8 s = strike · swipe a mark again to undo". For `order` the marks get numbers in swipe order.
- **4D many options:** `AMBUSH · 7 OPTIONS · 5 NINJAS`. Each option lists its mark and the ninja carrying it. 8 directions; front 3 strike in wave 1, back 2 in wave 2.

### 5 Outcome

- **5A Correct:** `+100`. The scroll rolls up, slow motion snaps back. Picked ninjas slain, the others blocked and fleeing.
- **5B Wrong:** score `+0`, the lost chunk of the life bar flashes and drops off, red edge flash, haptic buzz (can be turned off in settings). A ninja lands the hit, all vanish. About 1 s, then the run resumes.
- **5C Unanswered:** time ran out. The front ninja slices through the scroll, then all hit (one hit). The halves of the scroll fall away and the run resumes.

### 6 Pause

- This run: quiz, stage, answered (`11 / 13`), distance.
- **Resume**, **Restart stage**, **Settings**, **Quit**.
- Auto-pauses when the app goes to the background or a call comes in. 3-2-1 countdown on resume.

### 7 Finished: results and mistakes

- 勝 · `QUIZ PASSED · NEW HIGH SCORE` · score, with the previous best (`was 2,210`).
- `17 / 20 correct (85%) · 4:05`.
- Breakdown: **Correct** (`17 × 100`), **Time** (tiebreak for the high score), **Distance** (stage cleared).
- **Mistakes** scroll: each miss with ✗ your pick, ✓ the right answer, the explanation and references.
- **Next stage**, **Practise mistakes**, **Menu**.

### 8 Fallen

Shown instead of 7 when the life bar is empty.

- 散 · **Fallen** · stage and distance reached (`1,120 of 1,500 m`) · "life bar empty: 70% is out of reach".
- 3D samurai on one knee, katana dropped, ink-wash grey, petals falling.
- Correct (`8 / 11`, best possible 65%), **run score** (marked "not a high score"), time.
- "What cut you down": the mistakes scroll, tap to expand.
- **Rise again**, **Practise mistakes**, **Menu**.

## Dojo

See [dojo.md](dojo.md) for the rules.

### D1 Dojo menu

- 道場 · **Dojo** · quiz picker (`v3 · 40 questions`).
- **Study** card, with calligraphy-set art (文武, brush, inkstone).
- **Practice** card, with the training dummy from D3.
- Checkbox **Only my mistakes from the last run (3)**.

### D2 Study

- Progress (`12 / 40`), `▶ playing · shuffled loop`.
- The word being spoken is highlighted: grey background and underline.
- Card: category, type, query, and **Correct answer**. `multiple` lists all correct options, `order` the right sequence, `solutions` each solution with yes/no.
- **Pause**, **Restart**, **Voice** (`System (en-US)`), **Speed** (`− 1.5× +`).

### D3 Practice start

- Quiz, question count, "mistakes only: off".
- 3D training dummy holding a bamboo sword. "no timer · no life bar · no score".
- **Start**.

### D4 Practice ambush

Like 4A, with `PRACTICE · SINGLE · 8 / 40` and the running right vs wrong percentage. A speaker button reads the card aloud. No timer, no life bar, the dummies don't move.

### D5 Practice miss

- `PRACTICE · MISSED`. The options show ✓ correct and ✗ your pick, followed by the explanation.
- The dummy swings back: thwack.
- Speaker button reads "The answer is alt", then the explanation. No life lost.
- **Continue**.

## Notes

- **Novice / Adept / Master** on screen 2 maps to `timeScale` (exact values to tune in playtests).
