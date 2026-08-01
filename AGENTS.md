# Navio contributor guide

This file is a short orientation for contributors and coding agents. Keep
changes focused on the requested behavior or documentation, and explain any
uncertainty in the pull request instead of guessing about the library's API.

## Project shape

- The public package entry point is `src/index.js`, which default-exports the
  `navio` function from `src/navio.js`.
- Most of the implementation lives inside the single closure created by
  `navio(selection, height)`. Internal helpers in that closure are not module
  exports, so do not try to import them from another file. Extend the public
  surface deliberately and update the README when it changes.
- The Rollup configuration creates the distributable bundles under `dist/`.
  Those build outputs are generated files, not hand-edited source.

## Build and test reality

From the repository root:

```sh
npm install
npm run build
```

`npm run build` is the verified build path and runs Rollup using
`rollup.config.js`. The package currently declares `npm test` as
`node test/test.js`, but this checkout has no `test/test.js`; treat that
command as a known repository gap, not as a passing test suite. If you add or
restore tests, update the script and this guide together.

For a source-only change, at minimum run the build when dependencies are
available and inspect the generated diff. Do not claim tests passed when the
test entry point is absent.

## Repository guardrails

- Do not modify large binary assets under `extras/` if that directory is
  present in a checkout. Keep binary changes out of ordinary code reviews.
- Do not force-push version tags. Use a feature branch for changes and let a
  maintainer handle releases.
- Do not run `example_d3v3/update.sh` as part of local validation. It contains
  a maintainer-specific SSH deployment command and is not a general build
  script.
- Keep deployment credentials, private paths, and machine-specific commands
  out of commits and issue comments.
- Durable review or roadmap notes belong under `docs/ai/` when that directory
  is introduced. The current default branch does not contain it yet.

## Pull requests

Describe the user-visible or maintenance problem, the smallest change that
addresses it, and the commands actually run. Include follow-up work as a
separate issue instead of broadening a focused patch.
