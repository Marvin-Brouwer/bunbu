<p align="center">
	<img src="apps/game/public/icon.svg" alt="" width="120" height="120">
</p>

<h1 align="center">Bunbu: Shogun Scholar</h1>

<p align="center">
	<strong>Learn by the sword.</strong> A samurai runs through old Japan, and every ninja ambush is a question from your quiz.
</p>

<p align="center">
	<a href="https://marvin-brouwer.github.io/bunbu/"><strong>Play Bunbu</strong></a>
	·
	<a href="docs/design/data-format.md">Write a quiz</a>
	·
	<a href="https://marvin-brouwer.github.io/bunbu/how-to-play/">How to play</a>
</p>

## The game

- **Run and answer.** The samurai runs on by himself. When ninjas ambush him, a scroll opens with the
  question and you cut the answers with a swipe. Right slays the ninjas, wrong costs life.
- **Pass the test.** Five stages, from the rice fields to Edo castle, each opened by passing the
  one before it. Four difficulties, from Apprentice to Shogun.
- **Train in the dojo.** Study every question with its answer read out loud, or practise without
  losing life.
- **Bring your own quiz.** Quizzes are plain YAML files: write one, load it, and share it with a
  friend as a `.bunbu` file.

It plays in the browser, phone first, and installs as an app that works offline.

## Making a quiz

The format, with an example of every question type, is in
[docs/design/data-format.md](docs/design/data-format.md). Start your file with the schema line and
your editor checks it as you type:

```yaml
# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/v1.json
```

There are sample quizzes in [docs/testdata/](docs/testdata/).

## Working on Bunbu

```sh
pnpm install
pnpm dev
```

Read [AGENTS.md](AGENTS.md) before you start: it points to the design docs, the folder layout and
the checks to run before pushing.

## License

The code is [MIT](LICENSE). The 3D models, fonts and sounds and their licenses are listed in
[ATTRIBUTION.md](ATTRIBUTION.md).
