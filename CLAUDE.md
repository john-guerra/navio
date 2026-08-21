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
src/navio.js        ~4550 lines, ONE closure. Most things still live here.
src/settings-panel.js   the gear, the panel, and everything drawn in it.
                    Composition root: it builds theme.js and
                    settings-storage.js, so navio.js constructs ONE thing.
src/settings-storage.js the settings object and localStorage. Reaches the
                    panel only through injected hooks - see Landmines.
src/theme.js        THEMES and which one applies. A leaf: imports only d3.
src/filters.js      the five filter factories + filterFromValue (serialisation)
src/scales.js       scaleText, scaleOrdered, null-safe comparators
src/NavioWidget.js  reactivewidgets.org wrapper: .value, input events
src/index.js        UMD entry - DEFAULT EXPORT ONLY (see Landmines)
src/index.esm.js    ESM entry, named exports
build/ascii.js      escapes non-ASCII literals (replaces rollup-plugin-ascii)
build/verify-bundle.js  postbuild guard, runs automatically
docs/ai/            durable review docs - read FILTERING-MODEL.md before
                    touching filtering, sorting or selection
docs/ai/API.md      GENERATED from src/params.js by `npm run docs:api`. Every
                    option and method, for someone USING navio rather than
                    working on it. Never edit it by hand; a stale copy fails
                    the gate.
src/params.js       the one description of every option and method. The
                    settings panel, navio.describe() and docs/ai/API.md are
                    all built from it, so they cannot disagree. Adding an
                    option without an entry here fails the gate.
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

## Conventions

**Prefer standard browser controls.** When the platform already has an element
for the job, use it rather than building the behaviour out of divs and click
handlers: `<details>`/`<summary>` for a collapsible section, `<dialog>` for the
settings panel, `overflow-y: auto` for a scrolling list, a real `<button>`,
`<select>` or checkbox for a control. The native element brings its keyboard
behaviour, its ARIA state, focus handling and find-in-page for free, and a
hand-rolled version is a worse copy that has to be maintained. This is a
maintainer preference, stated directly — apply it to anything new in the
settings panel.

The exception is when the native behaviour is measurably wrong for the case, and
"measurably" means a number: `dialog.showModal()` was tried for the settings
panel and removed, because it centres in the VIEWPORT — with two Navios on a
page the panel appeared nowhere near the widget it belonged to — and its one
real advantage, the top layer, cannot escape the sandboxed cross-origin iframe
an Observable notebook renders its cells in.

## Landmines

Each of these has cost real debugging time here.

**Filters are evaluated once, at creation.** They are not live predicates
re-run on redraw. `applyFilters` materialises `selectedFlags`; re-sorting a level
deliberately never calls it, so sorting cannot change the selection. Range
filters compare *visual positions*, not values. Read
`docs/ai/FILTERING-MODEL.md` — a plausible mental model here is wrong and
produces designs that look right and are not.

**`nv.nestedFilters = false` is a second, barely-walked code path.** With it on
(the default) `applyFiltersAndUpdate` grows `dataIs` a level per filter, so the
level chain is always longer than 1 by the time anything downstream runs. With
it off the chain stays at length 1, and code guarded on `dataIs.length <= 1`
fires for the first time — that is how `deleteSubsequentLevels`, whose early
return forgot to hand `_dataIs` back, made brushing throw "Cannot read
properties of undefined (reading 'length')". The setting has a checkbox in the
settings panel, so users reach it. Any function that takes `_dataIs` and is
assigned to its caller's variable must return it on **every** path.

**Hiding every column empties the attribute scale's domain.** `xScale.domain()`
becomes `[]`, `domain()[0]` and `domain()[length - 1]` are `undefined`,
`scaleBand` answers `undefined` for a value it does not know, and
`levelScale(level) + undefined` is `NaN`. d3 then writes that into SVG
attributes and the browser rejects each one — several console errors per
redraw, no exception, nothing that fails a test that only asserts on the model.
Guard on `domain.length` before indexing it. `drawLink` reads the same
`domain()[length - 1]`.

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

**`NavioWidget.value` is the selected ROWS; the filter chain is separate.**
`.value` used to be the chain, which broke the one thing the reactive-widget
contract is for — `viewof selected = navio(data)` handed every downstream
Observable cell a list of filter descriptors where it expected data. The chain
lives on `getFilters()`/`setFilters()`. Both are needed and neither
substitutes: rows are projections through *this* instance's arrays, so binding
two Navios on `.value` gives the peer one flat level where the source has three.
Bind Navio-to-Navio on the chain, Navio-to-anything-else on `.value`. A knock-on:
assigning `.value` used to re-apply a widget's own filters back to itself on
every user change, which quietly snapped its brush rect to row edges. It no
longer does, so a source and a synced peer can differ by up to one row visually
while selecting exactly the same rows.

**A percentage `max-height` resolves against the widget, not the screen.** The
settings panel was capped at `70%`, which is 70% of the Navio container — 140px
on a 200px-tall widget, so the panel rendered as a scrolling sliver cut off
mid-list. In an Observable notebook, with a block of code immediately below, that
reads exactly like the panel being painted *under* the next cell, and the obvious
fix (raise the z-index) does nothing. `test/e2e/93-stacking.spec.js` reproduces
observablehq.com's real cell nesting — `.notebook` is `position:relative;
z-index:0`, cells are `position:relative` with `z-index:auto`, CodeMirror's
`.cm-scroller` is `position:relative; z-index:0` — and shows the panel wins at
any z-index down to 1. It also pins the diagnosis: if that test ever fails, the
problem really has become one of stacking. Note too that observablehq.com renders
the whole notebook body inside one sandboxed cross-origin iframe, so nothing
Navio draws can escape a cell by z-index anyway.

**A module gets GETTERS, not values.** `src/navio.js` hands each extracted
module a context object, and every non-`const` closure binding in it must cross
as `get x() { return x }`. This is not style. `init()` rebinds `selection` from
the caller's argument to a d3 selection, and `canvas` is assigned there too -
both long after the module factories are constructed. A plain property captures
the value at construction and goes stale, and for `selection` that means the
module holds the caller's *string* and throws on `.append()`.

The rule is about WHAT the binding is, not which name it has: a `const`
(`instanceId`), a hoisted `function` declaration (`announce`, `visibleAttribs`,
`getAttribName`, `moveAttrToPos`) and `nv` - never rebound - are safe as plain
properties. **Every `let` in the chain at line 71 crosses as a getter**, and one
the module writes back to needs a setter as well (`height`, `hiddenAttribs`).
`test/e2e/67-extraction.spec.js` pins this; 20 of the 25 e2e fixtures pass
`d3.select("#nv")` and none passed a string before that spec, so the string
path is easy to leave untested.

**The settings modules must not import each other.** `settings-panel.js`
imports `settings-storage.js` and `theme.js`; neither imports back. Storage
reaches the panel through `hooks` (`redraw`, `isOpen`, `getCollapsed`,
`setCollapsed`) and `applyTheme` lives in the panel rather than beside the
theme table, because it restyles the panel's own elements. Function-declaration
cycles survive ES modules; **factories returning objects do not** - with a cycle
neither can be constructed first.

**Construct the panel where the slice was, never at the top of the closure.**
It registers seven public methods on `nv`, and `OPTION_NAMES` snapshots
`Object.keys(nv)` at ~336. Built any earlier, those methods become "options":
`getOptions()` reports them, `applyOptions` accepts them, and
`test/e2e/104-describe.spec.js` fails. `npm run check` does not run e2e, so that
one lands green on the gate.

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

**Do not cache resolved link endpoints.** `recomputeVisibleLinks` resolves
`link.source`/`link.target` through `indexOfRow` on every call, which looks
wasteful — it is not safe to cache. Callers mutate the link array in place: that
is the whole d3-force convention, where `forceLink` rewrites `source`/`target`
from ids to node objects after Navio has already seen them. A cache keyed on
`links.length` misses that entirely, silently drops links, and can make
`drawLink` dereference `data[undefined]` and abort the redraw. It was tried, it
regressed, it was reverted; `test/e2e/61-link-endpoints.spec.js` pins it. The
measured saving was ~4ms out of a ~33ms update where *drawing* the links is the
real cost.

**All geometry goes through `toXY()`.** Navio has two logical axes: the
ATTRIBUTE axis (columns) and the RECORD axis (one line per row). `x(val, level)`
and `yScales[level]` are the attribute-axis and record-axis scales — those names
are historical, they are not screen x and y. `nv.orientation = "vertical"`
transposes them. Any new geometry must be expressed in (attribute, record) and
mapped through `toXY`/`toWH`, and any code reading a pointer must swap axes the
way `showTooptip` does. A site that hardcodes screen x/y works in horizontal and
silently misplaces itself in vertical.

**Playwright's `reuseExistingServer` will attach to another project's server.**
It only checks that *something* answers on the port, not that it is serving this
repo. A dev server from a sibling project (or another worktree of this one) took
over 4173 here and the suite ran against 404s and an empty bundle - failures
that look like real regressions, and, worse, could look like passes. Run
`NAVIO_TEST_PORT=4190 npx playwright test` when anything else might be up, and
check the port if results stop making sense.

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

Under 0.x, breaking changes go in the **minor** slot.

## Releases

Two commands, in this order, and **the second one is the maintainer's** — npm
credentials are not available to agents, so an agent prepares a release and
stops:

```bash
npm version patch     # or minor. Bumps, gates, commits, tags LOCALLY.
npm publish           # gates again, publishes, then pushes and releases.
```

An agent's part is: land the work on `main`, add the version's section to
`CHANGELOG.md`, and say it is ready. Nothing else.

**The order is enforced, not remembered, and that is deliberate.** This section
used to read "bump, gate, commit, tag, push both, create the GitHub release" and
0.3.0 still went to npm with no tag in the repo at all — the step that gets
skipped is the one a human has to remember after the interesting part is over.
So each step now lives in the npm lifecycle hook that can only run at the right
moment:

| hook | script | what it is for |
| --- | --- | --- |
| `preversion` | `build/before-version.mjs` | Refuses to start on a dirty tree, off `main`, or behind `origin`. |
| `version` | `docs:api` + `check` + `git add -A` | A release cannot carry a stale `docs/ai/API.md` or a red gate. |
| `prepublishOnly` | `check` | `dist/` is gitignored; nothing else guarantees the published bundle matches its source. |
| `postpublish` | `build/after-publish.mjs` | Pushes `main --follow-tags` and creates the GitHub release **only after npm accepted the package**. |

The tag therefore exists locally before publishing and is pushed only if the
publish succeeded. That is the whole point: a tag pushed before a failed publish
points at a commit that may need to change, a published tag must never be moved,
and the version is then burnt. A local tag costs nothing to delete and retry.

`build/after-publish.mjs` never exits non-zero — the package is already
published by the time it runs, so failing would only make a finished release
look broken. It prints the command to run by hand instead.

The GitHub release body is the `## <version>` section of `CHANGELOG.md`, so
`npm run check` fails if the version being released has no section — headings
inside one must be `###`, since `##` starts the next version.

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
