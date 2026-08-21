# Injecting the geometry — a Plot-inspired data flow for navio (2026-08-21)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `650b2e7`. Follows
`docs/ai/2026-08-20-navio-decomposition-design.md`, which extracted the settings
panel, storage, theme and attributes and established the module mechanism.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** design only. Nothing here is implemented.

**Revision note.** The first draft of this document proposed a **per-update
frame** object, built by the derive phase and passed to renderers. Two
independent reviews — one architectural, one performance, run against that draft
— rejected it. Three of its load-bearing decisions did not survive contact with
the code, and its central performance justification was false. §11 records all of
it, because the *reason* the draft was wrong generalises: it reasoned from an
analogy to Observable Plot instead of from navio's own lifetimes. This revision
keeps Plot's discipline and drops Plot's mechanism.

---

## 0. Summary

`src/navio.js` is 4,185 lines. Its renderers — and, importantly, its **event
handlers** — reach into eight shared geometry bindings. Any module boundary drawn
around them therefore has a wide interface by construction, which is why
extraction by topic has stalled.

This design introduces **`geom`**: navio's coordinate system, built **once** in
`init()` and injected into everything that computes a position — renderers and
handlers alike. Its methods read live state at call time.

### Why this and not a per-update frame

Plot passes a fresh context per render because Plot **re-renders wholesale**;
nothing outlives the render that built it. navio's handlers do outlive it, by
design: `drawBrushes` binds `updateBrushes` on **enter only** unless
`recomputeBrushes` (`src/navio.js:2653-2657`), and `nv.update` defaults
`recomputeBrushes` to **false** (`3523`). So `brushed` and `onSelectByRange`
(defined inside `updateBrushes` at `1707`/`1734`) are created once per level and
survive arbitrarily many updates. A per-update object captured there goes stale,
and two of its fields are load-bearing: a captured `isVertical` boolean puts a
brush on the wrong axis after an orientation flip, and a captured `pixelRatio`
re-opens #105 (striped, diluted columns) silently.

A long-lived object with **methods** has no such failure mode. It behaves exactly
as the closure does today — reads resolve when used — while making every reader's
dependency explicit in its signature.

### The honest justification

Not the lines-per-interface metric. That metric estimates cost and exposes
coupling; the maintainer's standing instruction is that **semantics choose
boundaries and size is secondary**, and §0 of the previous design withdrew the
~800-line target. What `geom` concretely buys is this: `records/`, `levels/` and
`attributes/` become extractable **without a nine-getter context object each**,
and navio's geometry becomes unit-testable for the first time — the thing every
geometry landmine in `CLAUDE.md` is about.

---

## 1. What navio already has

`nv.updateData` (`src/navio.js:3464`) is already Plot's pipeline:

```
mutate instance state (colScales, dataIs, filtersByLevel, dBrushes)
  -> recomputeVisibleLinks()
  -> updateScales({levelsToUpdate, shouldUpdateColorDomains})   DERIVE
  -> updateWidthAndHeight()                                     DERIVE
  -> nv.update({...})                                           RENDER
  -> maybeRestoreSettings()
```

Plot: normalise options -> `createScales` -> `createDimensions` ->
`mark.render(index, scales, values, dimensions, context)`.

The shape matches. What does **not** match is the lifetime: Plot's marks are
created and discarded per render; navio's handlers persist. Adopting the shape
without checking the lifetime is the error the first draft made.

**And the phases are not clean.** `applyHeaderBand` writes `headerSpill` and
`nv.y0` *from inside* `updateScales` (`2337`, `2350-2351`, called at `3159`);
`pixelRatio` is written in `updateWidthAndHeight` (`3339`), after;
`explanationsPad` is written **during render**, inside
`drawFilterExplanationsHTML` (`2196-2198`), which calls `applyContainerSize()`
reentrantly. There is no instant at which a complete derived snapshot exists.
`geom` does not need one.

---

## 2. Facts that constrain the design

Each was measured, and each killed a plausible alternative.

**Scales are created once and mutated in place — except `yScales`.** `xScale`,
`levelScale` and `x` are assigned at `925`, `932`, `935` inside `init()`, which
runs exactly once (`4130`), and are never reassigned. But
`yScales[levelToUp] = d3.scaleBand()` at `3162` creates **fresh objects every
update**, for the field with the most references. Any statement that navio
preserves scale identity across updates is false for the majority case.

**The `invertScaleCache` argument in the first draft was wrong, and is
withdrawn.** `updateScales` calls `invalidateInvertCache()` at `3197`, which does
`invertScaleCache = new WeakMap()` (`1015-1017`). **The cache is discarded on
every update regardless of scale identity.** Its purpose is memoisation across
pointer events *between* updates (#62), not across updates. Measured miss cost at
realistic domain sizes: **6.45µs** at 1,205 entries, **6.55µs** at 2,440; a hit is
0.034µs. Worst case, all-miss at 120Hz mousemove, is ~0.8ms/s. The cache is worth
keeping and is not a reason to constrain anything.

**`height` is not derived, and it is co-owned.** Written at `3924` (the
`nv.height` setter) and `1268` (settings restore) — user intent. It also crosses
into two already-extracted modules through the `get height()`/`set height(v)`
pair at `1264-1269`: `settings-panel.js:79,82` and `settings-storage.js:58,121`.
The first draft's claim that no extracted module touches a geometry field is
**withdrawn**; `height` is the counterexample.

**`nv.y0` is simultaneously user intent and derived output.** It is a documented
public option (`src/params.js:99`) *and* is written by `applyHeaderBand` at
`2350` when `autoHeaderSpace` is on. It must be resolved explicitly — see §3.

---

## 3. `geom`

### What it is

navio's coordinate system: the one place that knows how an (attribute, record)
pair becomes a position on screen. Built once, injected, methods read live state.

### Two membership criteria, both stated

The first draft claimed one test and silently used two. Both are needed:

1. **Does it help answer "given an attribute and a record, where on screen is
   that, and how big?"** If no, it is not geometry.
2. **Is it navio's to compute, or the caller's to set?** A public option
   (`nv.attribWidth`, `nv.margin`, `nv.x0`, `nv.levelsSeparation`) is an *input*
   to geometry; `geom` reads it through `nv` rather than owning a copy.

Roughly 54 references to public options — `nv.margin` 15, `nv.x0` 7, `nv.y0` 7,
`nv.attribWidth` 7, `nv.levelsSeparation` 7, and others — pass criterion 1 and
fail criterion 2. That is why a renderer given `geom` still legitimately sees
`nv`.

**`nv.y0` is resolved inside `geom`.** `geom.recordAxisStart()` returns the
resolved band offset; `nv.y0` remains the *requested* value, which
`autoHeaderSpace` may override. Nothing else reads `nv.y0` for layout.

### The interface

```js
const geom = createGeometry(ctx);   // built once, in init()

geom.isVertical()            // a FUNCTION, so a handler cannot capture a stale axis
geom.toXY(a, r)              // (attribute, record) -> {x, y}
geom.toWH(a, r)              // (attribute, record) -> {width, height}
geom.cellA(attribName, level)// position along the attribute axis  (today: x())
geom.recordAxisStart()       // resolved y0, honouring autoHeaderSpace
geom.extentA()               // extent ALONG THE ATTRIBUTE AXIS   (today: "width")
geom.recordExtent()          // extent along the RECORD AXIS      (today: "height")
geom.headerSpill()           // header overflow above the widget
geom.pixelRatio()            // device pixels per CSS pixel
geom.snapToDevice(coord, w)  // pixel-grid snapping (#105)
```

**`extentA` / `recordExtent`, never `width` / `height`.** CLAUDE.md's landmine:
*"A site that hardcodes screen x/y works in horizontal and silently misplaces
itself in vertical."* `updateWidthAndHeight` computes `alongA` and only then calls
`toWH` to get screen width and height (`3335-3336`), because vertical swaps them.
Naming these `width`/`height` inside an object that also carries `toWH` invites
exactly that bug.

### What is deliberately NOT in it

- **`explanationsPad`** — it has exactly one read (`3401`,
  `full = ctxHeight + explanationsPad`), never enters a coordinate, and is
  written *during render*. It is container sizing, not geometry. Excluding it
  also removes the only mutate-during-render problem the first draft had.
- **`posAt`** — returns an ordinal position **within a level** (`1307-1310`), not
  a screen coordinate, and is passed **by identity** into long-lived filter
  objects (`getPos: posAt` at `1780`, `1792`, `3725`). It belongs to
  `filtering/`. See `FILTERING-MODEL.md`: range filters compare visual positions.
- **Instance state** — `data`, `dataIs`, `filtersByLevel`, `dSortBy`,
  `hiddenAttribs`, `selectedFlags`, `dBrushes`, `colScales`, `attribsOrdered`.
  Renderers receive what they need as their own arguments.
- **Ambient chrome** — `context` (57 refs), `canvas` (17), `svg`, `divNavio`.
  These travel separately: something that only computes a position should not be
  handed a drawing surface.

### Representatives are an open decision, not an omission

`computeRepresentatives` (`2932-2951`) decides which rows are drawn, is derived
per update from `recordExtent` and `dataIs[level].length`, and is **stashed as
properties on the caller-visible `dataIs` array** — `dataIs[l].representatives`,
`dataIs[l].itemsPerpixel` (`2941`, `2947-2949`) — then read by `updateLevel`
(`3324`). That is the clearest instance in the file of "derive stores, render
reaches for it", and it also writes to an array the caller can see, which sits
uneasily beside CLAUDE.md's "Navio never writes to the caller's rows".

It is navio's equivalent of Plot's `index`. **This design does not move it**, and
says so rather than leaving it implied. It should be resolved when `records/` is
extracted, and it is a better candidate for derived-and-passed than anything the
first draft proposed.

---

## 4. Scale of the change

Counted with **acorn**, not regex — excluding property keys, member properties,
declarations and shadowing parameters. Every regex-based number in the first
draft was wrong.

| Identifier | AST refs | first draft | |
| --- | ---: | ---: | --- |
| `yScales` | 52 | 53 | |
| `xScale` | 29 | 30 | |
| `isVertical` | 22 | 23 | |
| `toXY` | 21 | 22 | |
| `levelScale` | 20 | 21 | |
| `x` | **13** | 39 | property keys in `{x: r, y: a}` |
| `height` | **12** | 21 | property keys in `toWH` |
| `headerSpill` | **12** | 10 | regex *under*-counted |
| `toWH` | 7 | 8 | |
| `pixelRatio` | 6 | 7 | |
| `explanationsPad` | 3 | 4 | excluded from `geom` anyway |

**~197 reference sites**, not the ~250 first claimed. All in `src/navio.js`,
except `height`, which is co-owned with the settings modules (§2).

### Where they live

~37 of them are in code that runs on a **pointer event or a public call**, not
during an update: `updateBrushes` and its nested handlers (17), `showTooltip`
(5), `showDropIndicator` (5), `restoreBrushes` (4), `columnAtPointer` (3),
`grownFontSize` (3), `dropTargetFor` (2), `draggedHeaderTransform` (2),
`attribDragended` (2), `dragAlongA` (1), `nv.setFilters` (1), `nv.destroy` (1).

That is ~19% of the total, it is the third of the code the first draft had no
answer for, and it is the entire reason `geom` is long-lived.

---

## 5. Renderer signatures

The first draft asked for a benchmark of `drawItem` without ever showing what it
would look like. Three concrete cases — the easy one, the hot one, the ugly one:

```js
// today
function drawLevelBorder(i)
// after
function drawLevelBorder(geom, i)

// today  — reads data, selectedFlags, colScales, visibleAttribs(), getAttribName,
//          getAttrib, idOf, isMissing, divisionsColour(), context, nv.nullColor,
//          nv.divisionsThreshold, plus geometry
function drawItem(rowIdx, level)
// after  — geometry and the drawing surface become explicit; instance state
//          stays on a single `state` argument rather than twelve parameters
function drawItem(geom, ctx2d, state, rowIdx, level)

// today
function drawAttributesHolders(levelOverlay, levelOverlayEnter)
// after
function drawAttributesHolders(geom, state, levelOverlay, levelOverlayEnter)
```

**`drawItem` is the reason `state` is one argument.** Twelve parameters is not a
signature that says what it reads; it is a signature nobody can call. The rule:
**geometry and the drawing surface are always explicit; instance state travels as
one named bag.** That is a deliberate concession, and it is where this design
stops short of "every signature declares everything".

---

## 6. Performance

Measured against the first draft's prototype, headless Chromium, dPR 1. **The
conclusion is that this is free if one rule is followed.**

| Variant | ms/update (h=600) | h=1200 |
| --- | ---: | ---: |
| closure reads (today) | 2.61–2.77 | 5.44 |
| per-read property access | 2.81–2.99 (**+7–10%**) | 5.98 (+10%) |
| **destructured once at entry** | 2.74 (**parity**) | — |

In the real pipeline the naive penalty was at the noise floor — **4.573 vs 4.640
ms** and **4.625 vs 4.625 ms** over 560 `nv.update()` calls at n=100k — but the
isolated loop shows it is real and grows with **widget height**.

**Requirement: hot renderers destructure `geom` once at function entry**, not
per read. `drawItem` and the `drawLinks` loop specifically.

**Where the cost actually is.** `drawItem` calls per update are capped by
**height, not row count**: 1,000 at n=1k, 1,205 at n=100k, 2,440 at h=1200.
Render is flat in n (4.17 / 5.04 / 4.84 ms for 1k / 20k / 100k). The only
n-linear cost is colour-domain recomputation, ~3.2ms at 100k. **Nothing in this
design touches an n-scaling path.**

**Allocation is a non-issue and must not be optimised here.** `toXY` already
allocates ~16,870 `{x, y}` objects per update at h=600. A zero-allocation
scratch-object variant measured **2.64–2.80 vs 2.61–2.77** — indistinguishable.
V8 handles these for free.

**Bundle:** measured +331 bytes minified for 28 converted sites; extrapolating to
~197 gives **+1.8% to +3.0%**, comparable to the settings extraction's 2.65%.
Terser mangles closure names to 1–2 characters but cannot mangle property names.
Record the size at each step.

**Benchmark harness, so the gate measures the right thing:** N full
`nv.hardUpdate()` calls on a fixed dataset, wall time, reported as a
distribution, same machine and browser — **not** a microbenchmark of `drawItem`,
where `context.stroke()` and `measureText` dominate by orders of magnitude. Add a
`?links=5000` case when step 4 converts `drawLinks`; that path is unmeasured.

---

## 7. What does not change

- **The public API.** Every `nv.*` method keeps its name, arity and behaviour.
  `params.js` stays the single description; `docs/ai/API.md` stays generated.
- **`nv.update()` / `nv.hardUpdate()` signatures.**
- **The UMD global stays a callable function.**
- **Filtering semantics.** Filters are still evaluated once at creation;
  `applyFilters` still materialises `selectedFlags`; range filters still compare
  visual positions. Read `FILTERING-MODEL.md` before touching `filtering/`.

---

## 8. Sequencing

Each step is a separate commit; each must pass `npm run check` **and**
`NAVIO_TEST_PORT=4190 npx playwright test` before the next. `npm run check` does
not run e2e.

1. **Add `geom` and one regression test.** Build it in `init()`, use it nowhere.
   The first draft proposed asserting `geom`'s fields equal the closure bindings
   — unwritable (the closure is not observable, per CLAUDE.md) and vacuous where
   writable (`geom.xScale === xScale` is `a === a`). Instead, following
   `test/e2e/67-extraction.spec.js`, pin the **distinctive failure mode**: create
   a level, change `nv.attribWidth` or flip orientation, then drag the brush on
   the old level and assert the selected rows are the ones under the pointer. Add
   the first **unit** test of navio geometry: construct `geom` with fake scales
   and assert horizontal/vertical transposition.
2. **Convert `drawLevelBorder`.** Geometry-only, no instance state.
3. **Convert the handlers first, not last.** `updateBrushes`, `showTooltip`,
   `columnAtPointer`, `showDropIndicator`, `restoreBrushes`. They are ~19% of
   sites and the ones the first draft broke. Doing them early proves the
   long-lived design where it matters.
4. **Convert the record renderers** — `drawItem`, `updateLevel`. Destructure at
   entry (§6). Benchmark per §6 and report the numbers in the commit.
5. **Convert the level renderers** — `drawLinks`, `drawLine`,
   `drawLevelConnections`, `drawCounts`. Add the `?links=5000` benchmark.
6. **Convert the attribute-header renderers** — `drawAttribHeaders`,
   `drawAttributesHolders`, header band.
7. **Delete the geometry bindings from the `let` chain.**
8. **Move files into directories** (§9). Pure renames. **Update `CLAUDE.md`'s
   Layout block in the same commit** — `test/unit/agent-guide.test.js:48-57` only
   validates inline-backticked paths, and the Layout block is fenced, so the gate
   will not catch a stale one.

**On step 7's safety.** `eslint.config.js` uses `js.configs.recommended`, which
sets `no-undef: error`, so deleting `let yScales` with a bare reader left behind
**fails `npm run check`**. That guarantee is real but narrow: it covers bare
identifiers only. A typo in the *new* form — `geom.yScale` — yields `undefined`,
then `NaN`, which d3 writes into an SVG attribute and the browser rejects
silently: console errors per redraw, no exception, no failing test. That is
CLAUDE.md's "hiding every column" failure mode. Mitigations, both required: do
the conversion as a **whole-identifier codemod** rather than by hand, and
**`Object.freeze` the `geom` object** so a typo throws in strict mode.
Note also that `nv.destroy` **rebinds** `yScales = []` (`4115`); step 7 must
settle teardown ownership, not just readers.

**Independence.** Steps 2–6 are individually revertible, with one qualification:
`drawBrushes` (`2641-2665`) calls `drawAttributesHolders`, `drawCounts` and
`drawFilterExplanationsHTML` from one place, so steps 5 and 6 cut through a
single call site. Reverting one leaves `drawBrushes` passing `geom` to some
children and not others — mechanically fine, but not the clean independence the
first draft claimed.

---

## 9. Directory map

Domain vocabulary, per the maintainer's decision. **Size is not a criterion.**

```
src/
  navio.js          the facade and instance-state kernel: the ~40 public nv.*
                    methods, the let chain, init(), and the update pipeline
  geometry.js       createGeometry: toXY, toWH, isVertical, cellA, extentA,
                    recordExtent, recordAxisStart, headerSpill, pixelRatio,
                    snapToDevice
  attributes/       definition and typing (attribs.js), ordering, visibility,
                    colour domains and scales
  records/          the record axis: rows, representatives, selection flags
  levels/           the level chain: borders, connections, links, counts
  filtering/        the filter algebra (filters.js), applying filters, brushes,
                    chips, posAt
  chrome/           settings panel, storage, theme, tooltip, loading, aria
```

`scales.js`, `palettes.js`, `params.js`, `utils.js` stay at `src/` — leaf
utilities, not concepts of the widget.

---

## 10. Risks

**Wide change to one file.** ~197 sites in the file every landmine is about.
Mitigated by sequencing, by the codemod, and by `no-undef` — with the narrowness
of that guarantee stated in §8.

**`geom` becoming a god-object.** The two criteria in §3 exist to prevent it and
should be applied to every proposed field.

**Orientation.** #22 is still open. `geom` keeps `isVertical` a *function* and
carries `toXY`/`toWH` beside it so a reader cannot get this half-right. This
design does not implement vertical layout.

**Rollup constant-folding.** Property reads are *less* provable than closure
reads, so the expected effect is mild growth — measured at +1.8–3.0% (§6) — not
branch deletion. Verify the bundle at each step anyway.

---

## 11. What the first draft got wrong

Kept because the cause generalises to the rest of #67.

| # | Defect | Cause |
| --- | --- | --- |
| 1 | No answer for ~37 sites in event handlers, which blocked its own payoff | Checked that navio's pipeline matched Plot's *shape*; never checked the *lifetime* that makes Plot's answer safe |
| 2 | `invertScaleCache` justification false — the cache is discarded every update (`3197`) and `yScales` are fresh objects anyway (`3162`) | Asserted a performance claim in a document whose §8 was titled "Measured, not reasoned" |
| 3 | Its WeakMap guard test reduced to `a === a` | A test derived from defect 2 could not fail |
| 4 | No moment exists at which a complete derived snapshot is correct | Took the pipeline diagram at face value; `explanationsPad` is written during *render* |
| 5 | `x` counted 39, really 13; `height` 21, really 12 | Regex counted **property keys** — the previous design's §11 fixed comments and strings and never extended the rule |
| 6 | Claimed no extracted module touches a geometry field | `height` crosses through the getter pair at `1264-1269` |
| 7 | Claimed one membership test while using two | Never noticed the public-option criterion doing half the work |
| 8 | `explanationsPad` declared to pass the test | It has one read and never enters a coordinate |
| 9 | Blamed `ugrep` for a wrong count | **The pattern was wrong, not the tool.** `grep -c toXY` returns 26. Asserting an unverified cause, in the section about rigour |
| 10 | `width`/`height` as field names | Re-introduced the axis confusion the landmine is about |

The through-line: **an architecture borrowed on the strength of a shape match
fails on the lifetime mismatch underneath it**, and every measurement shortcut
taken to support it produced a confident, wrong number.

---

## 12. Out of scope

- Vertical layout (#22).
- Any change to the filtering model or the public API.
- Moving `computeRepresentatives` (§3) — flagged, deferred to `records/`.
- Unit tests for `settings-storage.js` / `settings-panel.js` (#108) and the
  `initSettingsPanel` teardown bug (#109).
- Making navio declarative. Only Plot's discipline is adopted — derived state is
  produced and passed rather than reached for — not its statelessness.
