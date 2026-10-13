# Dojo

The dojo is where you learn without risk. It has two modes, Study and Practice, both picked on the [dojo menu](screens.md#d1-dojo-menu). There is no score and no high score in the dojo.

## Study

Hands-free revision.

- Every question of the quiz with its correct answer, shuffled, read aloud by the browser Speech API on a loop.
- What is read: the query, then "the answer is …". `multiple` lists all correct options, `order` gives the right sequence, `solutions` gives each solution with yes or no, `match` each row with its answer. Code blocks are not read; an image is read by its alt text.
- The word being spoken is highlighted to help with focus: a grey background and an underline. Where the browser doesn't say which word it is at, the word is guessed from the time spoken, at the pace the voice read the sentences before (as on Android); where it can't mark text at all, there is no highlight.
- Pronunciation uses the quiz's `pronunciations` and the built-in dictionaries (see [data format](data-format.md#pronunciations)).
- The card is plain text on the page, not on a scroll; it scrolls on its own when it is long, and follows the part being read.
- Controls: **Pause** (then **Play**) and **Skip** docked at the bottom. Skip goes on to the next card, read aloud or not, so the cards can be gone through without sound. There is no previous.
- A settings button at the top right opens the settings in place of the card, so the reading goes on while they change. Reading aloud has two settings there, kept with the others: **Voice** (the system's own for the quiz's `language`, or one of the voices for it, kept per language) and **Reading speed**, a slider from 0.5x to 3x in steps of 0.5 with a notch at each step.
- The screen stays on while studying, without going full screen. Locking the phone stops the reading: browsers only speak while the page is on screen (Chrome on Android and Safari on an iPhone both stop). Study picks up again from the sentence it was on once the phone is unlocked.
- If the browser won't start reading before a tap, as when Study is opened straight from a link, it shows paused, and **Play** starts it.

<img src="screens/d2-study.png" alt="Study" width="195">

## Practice

The ambush without the risk.

- A start screen with the training dummy and a **Start** button. The same dummy is the Practice art on the dojo menu.
- Then the [ambush](gameplay.md#ambush) without the stage: wooden training dummies instead of ninjas, a bamboo sword instead of a katana. The dummies don't move.
- The card is shown. Reading aloud is a button press, not automatic.
- A miss shows the right answer and the explanation; the speaker button reads them aloud. The dummy swings back. **Continue** moves on.
- No life bar, no death and no timer.
- It can pause, and plays full screen on a phone like a run: Back or leaving full screen pauses, resuming goes full screen again, and Back while paused leaves practice ([pause](screens.md#6-pause)).
- A running right vs wrong percentage is shown, so you can see how you're doing. It is not a score and isn't stored.

<img src="screens/d3-practice-start.png" alt="Practice start" width="195"> <img src="screens/d4-practice.png" alt="Practice ambush" width="195"> <img src="screens/d5-practice-miss.png" alt="Practice miss" width="195">

## Practise mistakes

**Only my mistakes from the last run** on the dojo menu filters Practice to the questions missed in the last run, when that run was on the same quiz and version. A question left unanswered counts as missed, and a question missed in several rounds is practised once. The **Practise mistakes** button on the [results](screens.md#7-finished-results-and-mistakes) and [fallen](screens.md#8-fallen) screens opens the dojo menu with that box ticked (`/dojo/?mistakes`), so Study stays a choice too.
