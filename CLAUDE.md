# Working on Navio

Navio is a d3 widget for summarising and exploring tabular data: one column per
attribute, one pixel row per record, with multi-level drill-down filtering. It
ships as a library (npm `navio`), so the public surface and the bundle shape
matter as much as the behaviour.

This file records the things that are **not** obvious from reading the code, and
the mistakes this repo has actually produced. Skim the "Landmines" section before
changing anything in `src/`.

## Commands

```bash
npm run check      # format:check + lint + unit tests + build. The gate.
npm run build      # rollup -> dist/{navio.js,navio.esm.js,navio.min.js}
npm test           # vitest, unit only
npx playwright test  # e2e. Needs a current dist/ - run build first.
npm run lint:fix   # eslint --fix
npm run format     # prettier --write
```

`npm run check` does **not** run the e2e suite. A change to `src/` is not
verified until both `npm run check` and `npx playwright test` pass.

**Check exit codes, do not grep output.** A rollup `SyntaxError` prints the word
"Error" capitalised and does not match a grep for `error`; that mistake pushed a
red build in this repo, and Playwright then silently tested a stale `dist/` from
the previous day. Capture to a file and test `$?`:

```bash
npm run build > /tmp/build.log 2>&1; echo "EXIT: $?"
```

## Layout

```
src/navio.js        ~2800 lines, ONE closure. Almost everything lives here.
src/filters.js      the five filter factories + filterFromValue (serialisation)
src/scales.js       scaleText, scaleOrdered, null-safe comparators
src/NavioWidget.js  reactivewidgets.org wrapper: .value, input events
src/index.js        UMD entry - DEFAULT EXPORT ONLY (see Landmines)
src/index.esm.js    ESM entry, named exports
build/ascii.js      escapes non-ASCII literals (replaces rollup-plugin-ascii)
build/verify-bundle.js  postbuild guard, runs automatically
docs/ai/            durable review docs - read FILTERING-MODEL.md before
                    touching filtering, sorting or selection
```

`src/navio.js` is a single closure. Its internal helpers are **not exported and
cannot be imported** — do not write a unit test that reaches into them, and do
not assume a function is available outside the file. Behaviour that lives in the
closure gets tested through the browser (see Testing).

`d3` and `popper.js` are **external** (see `rollup.config.js`). Navio does not
bundle them; it reads them off the host page. That coupling is invisible at load
and only fails on interaction — an example serving d3 v4 threw
`d3.pointer is not a function` only when someone sorted a column. A unit test
(`test/unit/examples-d3-version.test.js`) now fails if any example pins d3 < 7.

## Landmines

Each of these has cost real debugging time here.

**Filters are evaluated once, at creation.** They are not live predicates
re-run on redraw. `applyFilters` materialises `selectedFlags`; re-sorting a level
deliberately never calls it, so sorting cannot change the selection. Range
filters compare *visual positions*, not values. Read
`docs/ai/FILTERING-MODEL.md` — a plausible mental model here is wrong and
produces designs that look right and are not.

**Navio never writes to the caller's rows.** `selected`, `__i` and `__seqId`
used to be properties on every row; they are now side tables (`selectedFlags`
`Uint8Array`, `posByLevel` `Int32Array`), and `__seqId` is derived from the row's
index. Use `nv.isSelected(row)` and `nv.getRowsAtLevel(level)`. Anything
resolving an attribute by index must go through `attribAt(index, attrib)` —
`row["__seqId"]` is `undefined`, and reading it directly is exactly how a
serialized brush silently failed to rebuild.

**`filtersByLevel` is one longer than the level chain.** `updateData` maintains
`length === dataIs.length + 1` so there is always somewhere to put a new filter.
A one-level widget reports `[[], []]`. Test for "no filters" with
`every(l => !l.length)`, never `length === 1`. An earlier fix tried to truncate
it and was silently undone by the next redraw.

**Element ids are not unique across instances.** `#level0`, `#closeButton` and
friends are emitted per instance. `d3.select("#level0")` returns the *first*
instance's node. Scope to the instance (`selection.select(...)`,
`brushesOnLevel(lev)`) or use `instanceId`. Two Navios on one page is a
supported, tested configuration.

**The tooltip lives on `<body>`, not in the container.** Popper anchors to a
*virtual* reference, and popper.js v1 resolves offsets against
`document.documentElement` for any reference without a `nodeType`. Inside a
positioned ancestor the browser resolves those same numbers against the
ancestor, putting the tooltip off by the container's distance down the page
(Observable cells are `position: relative`). Do not move it back.

**The UMD global must stay a callable function.** `src/index.js` is
default-only. Adding a named export beside the default turns the global into a
namespace object and `new navio(...)` throws "not a constructor" for every
existing user. `verify-bundle.js` checks this; do not silence it.

**Rollup will constant-fold a property that is only ever read.** A flag
initialised to a literal and never reassigned *within the module* had its
branches deleted from the bundle, so `staleSort ? a : b` became `b`. It is a
closure variable with an explicit setter now. If a branch works in the unit
tests but not in `dist/`, suspect this.

**Non-ASCII must be escaped in the bundle.** `build/ascii.js` handles string
literals and template elements; `verify-bundle.js` fails the build if a raw
glyph escapes. Terser re-decodes `\uXXXX`, hence `ascii_only: true`.

## Testing

**Vitest for pure logic** (`test/unit/`) — filters, scales, utils, serialisation.
**Playwright for everything else** (`test/e2e/`). Canvas rendering, real pointer
and brush interaction, and multi-instance DOM state cannot be faithfully
reproduced in jsdom; do not try. Jest was evaluated and rejected over ESM
transform friction with d3's ESM-only packages.

Specs are named after the issue they pin (`88-no-row-mutation.spec.js`). Fixtures
live in `test/e2e/fixtures/`.

**Prove a new test fails without the fix.** Revert the change, run the spec,
confirm it fails, restore. Several "fixes" in this repo were verified against
tests that would have passed either way.

**Measure performance claims; do not reason about them.** Two perf issues here
correctly identified *where* the cost was and were wrong about *why* — one
assumed a row-sized array copy that is actually capped at the widget height. A
400-iteration benchmark showed nothing where 20k iterations showed 31%. Report
the numbers.

## Workflow

Commit small and often, each change as its own checkpoint, and comment the
outcome on the matching GitHub issue. Do not batch several fixes into one
commit.

`git add a b c` **aborts entirely** if any pathspec does not match — including a
file already staged as deleted. That silently left `package.json` unstaged here
while CI kept failing on a fix believed to be pushed. Verify with
`git diff --cached --stat` before committing.

Releases: bump `package.json`, run the full gate, commit, tag `vX.Y.Z`, push both,
create the GitHub release. **Do not run `npm publish`** — that is the
maintainer's, and npm credentials are not available to agents. `prepublishOnly`
runs the gate, since `dist/` is gitignored and nothing else guarantees the
published bundle matches its source.

Under 0.x, breaking changes go in the **minor** slot.

## Guardrails

- `dist/` is gitignored and built by the Pages workflow. Never commit it.
- `extras/` and `*.sketch` are large binaries. Leave them alone.
- `update.sh` is machine-specific to the maintainer. Do not run or edit it.
- Never force-push or move a published version tag.
- Notebook tarballs under `examples/` are gitignored; the notebooks on
  observablehq.com are the source of truth.
- Temporary scripts and probe files belong outside the repo, and throwaway specs
  must be deleted before committing.

## Debugging

`nv.DEBUG = true` traces internals, but only after construction. To capture
construction and the first `data()` call, set the default first —
`navio.DEBUG = true`, or `window.NAVIO_DEBUG = true` before the script loads.
`navio.version` reports the loaded build, which is also printed once per page
load. Worth checking before debugging anything reported from a CDN or a notebook.
