# Dojo

The dojo is where you learn without risk. It has two modes, Study and Practice, both picked on the [dojo menu](screens.md#d1-dojo-menu). There is no score and no high score in the dojo.

## Study

Hands-free revision.

- Every question of the quiz with its correct answer, shuffled, read aloud by the browser Speech API on a loop.
- What is read: the query, then "the answer is …". `multiple` lists all correct options, `order` gives the right sequence, `solutions` gives each solution with yes or no.
- Pronunciation uses the quiz's `pronunciations` and the built-in dictionaries (see [data format](data-format.md#pronunciations)).
- Controls: **Pause** and **Restart** (reshuffle and start again from card 1), plus voice and speed. There is no previous/next.

## Practice

The ambush without the risk.

- A start screen with the training dummy and a **Start** button. The same dummy is the Practice art on the dojo menu.
- Then the [ambush](gameplay.md#ambush) without the stage: wooden training dummies instead of ninjas, a bamboo sword instead of a katana. The dummies don't move.
- The card is shown and read aloud when it opens.
- A miss shows the right answer and the explanation, and reads them aloud. The dummy swings back.
- No life bar, no death.

## Practise mistakes

**Only my mistakes from the last run** on the dojo menu filters Practice to the questions missed in the last run. The **Practise mistakes** button on the [results](screens.md#7-finished-results-and-mistakes) and [fallen](screens.md#8-fallen) screens opens Practice with that box ticked.

## Defaults to confirm

- No timer in Practice.
- A **Continue** button after a miss, rather than moving on automatically.
- No score in the dojo.
