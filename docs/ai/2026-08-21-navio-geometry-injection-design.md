# Injecting the geometry — a Plot-inspired data flow for navio (2026-08-21)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `650b2e7`. Follows
`docs/ai/2026-08-20-navio-decomposition-design.md`, which extracted the settings
panel, storage, theme and attributes and established the module mechanism.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** implemented. See
`docs/superpowers/plans/2026-08-21-navio-geometry-injection.md` (Tasks 1-8)
for what actually landed and where it diverged from this design (the plan's
"Corrections found while writing this plan" section, and each task's own
notes).

**Revision note.** The first draft of this document proposed a **per-update
frame** object, built by the derive phase and passed to renderers. Two
independent reviews — one architectural, one performance, run against that draft
— rejected it. Three of its load-bearing decisions did not survive contact with
the code, and its central performance justification was false. §11 records all of
it, because the *reason* the draft was wrong generalises: it reasoned from an
analogy to Observable Plot instead of from navio's own lifetimes. This revision
keeps Plot's discipline and drops Plot's mechanism.

**Second revision note.** A second independent review, run against the rewrite
above, found the `geom` mechanism itself sound but its **interface** incomplete:
it covered only the forward mapping (attribute/record → screen) while its own
named first conversion targets need the inverse (screen → attribute/record). It
also found `Object.freeze` proposed as typo protection that does not work, no
stated contract for how `geom` must capture reassignable bindings, and one
excluded field (`explanationsPad`) with an unexcluded twin (`headerSpill`). §12
records these. §3 and §8 below are the corrected versions.

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
survive arbitrarily many updates. A per-update object captured there goes stale, and a captured `pixelRatio`
re-opens #105 (striped, diluted columns) silently.

**Correction from review.** An earlier version of this argument also claimed a
captured `isVertical` boolean would put a brush on the wrong *axis* after an
orientation flip. That overstates it: the axis a brush drags along is fixed by
which behaviour object was constructed — `d3.brushX()` vs `d3.brushY()`
(`src/navio.js:1663`) — and only rebuilding the brush, which happens when
`updateBrushes` re-runs, changes that. `nv.hardUpdate()` already defaults
`recomputeBrushes: true` for every level specifically because attribWidth,
margin and orientation changes need brushes rebuilt (`4024-4034`,
`restoreBrushes`'s own comment at `3760-3766`). That safety net exists today and
this design does not touch it.

`geom`'s real, more modest benefit is different and does not depend on a brush
being rebuilt: **pointer-driven code that runs *between* updates and reads
geometry it never had a chance to refresh**. `showTooltip`, `columnAtPointer`
and `dropTargetFor` (§3) are not bound once at level-creation like a brush
handler — they run fresh on every `mousemove`, but today they close over the
*same* `xScale`/`yScales`/`levelScale` bindings that any other closure code
does, which happens to work only because nothing in `navio.js` currently needs
to hand that reading capability to code outside the closure. The moment any of
this logic is extracted into `records/` or `levels/`, it stops being a closure
read and becomes an argument — and if that argument were captured once (a
frame, or a plain value), it would go stale in exactly the way a moved
`selection` did in the settings extraction. `geom`'s methods re-reading current
state at call time is what makes that extraction safe later, not what fixes an
orientation bug today.

A long-lived object with **methods** has no per-update staleness. It behaves
exactly as the closure does today — reads resolve when used — while making every
reader's dependency explicit in its signature, once that signature is complete
(§3 below fixes the gap review found in the first cut of it).

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
   that, and how big?" — in EITHER direction?** If no, it is not geometry.
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

**Correction from review: "either direction" is not decoration, it is a fix.**
An earlier version of this interface covered only the forward mapping —
attribute/record to screen — and criterion 1 was written without the qualifier
above. That is insufficient for the design's own §8 step 3, whose named targets
are `columnAtPointer`, `showTooltip`, `dropTargetFor` and `restoreBrushes`,
**all four of which invert a screen coordinate back to an attribute or a
record**:

```
src/navio.js:2685   dAttribs.get(invertOrdinalScale(xScale, alongA - levelScale(level)))
src/navio.js:1926   invertOrdinalScale(yScales[level], onR)
src/navio.js:1932   invertOrdinalScale(xScale, onA - levelScale(level))
src/navio.js:2690   invertOrdinalScale(xScale, dragAlongA(event) + ... - levelScale(d.level))
src/navio.js:3783   yScales[level](idOf(firstIndex))     // forward, but on the RECORD axis
src/navio.js:3786   yScales[level].bandwidth()
```

A forward-only interface would have forced these five call sites to reach past
`geom` for the raw `xScale`/`yScales`/`levelScale` objects — defeating the reason
those objects are hidden in the first place (§3's own `extentA`/`recordExtent`
naming rule exists to stop exactly this kind of raw-scale leak).

### The interface

```js
const geom = createGeometry(ctx);   // built once, in init(), AFTER init()
                                     // assigns xScale/levelScale/x (§3.1)

// forward: (attribute, record) -> screen
geom.isVertical()            // a FUNCTION, so a handler cannot capture a stale axis
geom.toXY(a, r)              // (attribute, record) -> {x, y}
geom.toWH(a, r)              // (attribute, record) -> {width, height}
geom.cellA(attribName, level)// position along the attribute axis  (today: x())
geom.cellR(rowId, level)     // position along the RECORD axis     (today: yScales[level]())
geom.recordAxisStart()       // resolved y0, honouring autoHeaderSpace
geom.extentA()               // extent ALONG THE ATTRIBUTE AXIS   (today: "width")
geom.recordExtent()          // extent along the RECORD AXIS      (today: "height")
geom.bandwidthR(level)       // row height for one level          (today: yScales[level].bandwidth())
geom.pixelRatio()            // device pixels per CSS pixel
geom.snapToDevice(coord, w)  // pixel-grid snapping (#105)

// inverse: screen -> (attribute, record) — the half the first cut omitted
geom.attribAtA(pos, level)   // screen position along A -> the attribute name there
geom.rowAtR(pos, level)      // screen position along R -> the row id there
```

`attribAtA` and `rowAtR` both go through `invertOrdinalScale`'s memoised
quantize scale (`1004-1011`) internally — the mechanism is unchanged, only its
caller. `headerSpill` is **removed** from this list; see below.

**`extentA` / `recordExtent`, never `width` / `height`.** CLAUDE.md's landmine:
*"A site that hardcodes screen x/y works in horizontal and silently misplaces
itself in vertical."* `updateWidthAndHeight` computes `alongA` and only then calls
`toWH` to get screen width and height (`3335-3336`), because vertical swaps them.
Naming these `width`/`height` inside an object that also carries `toWH` invites
exactly that bug.

### `createGeometry`'s own construction contract

The rule this repo already learned once (`CLAUDE.md`, "A module gets GETTERS,
not values") applies to `geom` itself, and the design states it explicitly
because the mechanism is new enough that a straightforward implementation could
violate it silently.

`xScale`, `levelScale` and `x` are assigned exactly once inside `init()`
(`925`, `932`, `935`) and never reassigned after — so `createGeometry` **must be
constructed after those three lines, within `init()`**, the same sequencing
constraint the settings extraction stated for `selection`. Capturing them as
plain values is safe only under that ordering; capturing them before it, or
capturing them as re-assignable bindings without a getter, reproduces the exact
bug class `CLAUDE.md` already catalogues.

`yScales` is different, and stricter: `updateScales` replaces individual
elements every update (`3162`), and **`nv.destroy` rebinds the whole array**,
`yScales = []` (`4115`). A `geom` that captured `yScales` by value at
construction would keep the entire pre-destroy array — every level's scale,
every domain — reachable through `geom` after `destroy()`, which is a **memory
leak specific to a correctly-functioning `geom`**, not a bug in destroy(). Every
method that reads `yScales` must do so through a getter, re-read at call time,
with no exception. The same applies to `pixelRatio` (reassigned at `962`,
`3339`).

### What is deliberately NOT in it

- **`headerSpill`** — moved out during review. All twelve reference sites are
  typography room (`grownFontSize`'s `room` calculation, `2224`) or CSS
  `margin-top`/`top` offsets on the canvas, the svg and the explanations div
  (`3355-3356, 3362, 3419-3420`). None feeds `toXY`, `toWH`, `cellA` or `cellR`
  for a data mark. It is container sizing — `explanationsPad`'s twin — not
  geometry, and the first cut of this design excluded one and kept the other
  with no test that told them apart. It stays in `navio.js`, read by the same
  handful of layout call sites that read it today.
- **`explanationsPad`** — one read (`3401`), never enters a coordinate, written
  *during render*. Container sizing for the same reason as `headerSpill`.
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

### Representatives: flagged, not classified as a violation

`computeRepresentatives` (`2932-2951`) decides which rows are drawn, is derived
per update from `recordExtent` and `dataIs[level].length`, and is **stashed as
properties on the caller-visible `dataIs` array** — `dataIs[l].representatives`,
`dataIs[l].itemsPerpixel` (`2941`, `2947-2949`) — then read by `updateLevel`
(`3324`). That is the clearest instance in the file of "derive stores, render
reaches for it", and it is worth resolving when `records/` is extracted.

**Correction from review: this is not the same landmine as #88.** An earlier
version of this section compared it directly to "Navio never writes to the
caller's rows." Checked: `nv.getRowsAtLevel` (`3803-3805`) returns
`dataIs[level].map(i => data[i])`, a **fresh array** — the caller never sees
`dataIs` or its extra properties. `dataIs` is navio's own internal index array,
not caller data; #88 was about properties leaking onto the *caller's* row
objects, shared across instances given the same array. The two are structurally
different, and the earlier comparison overstated the tension. It remains true
that this is navio's equivalent of Plot's `index`, and that this design does not
move it.

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
| `x` | **12** | 39 | property keys in `{x: r, y: a}`; corrected from 13 by an independent `eslint-scope` recount, which excludes the `invertOrdinalScale` shadowing parameter (`1000`, `1006`) that the acorn script's own declared-vs-referenced split miscounted by one |
| `height` | **12** | 21 | property keys in `toWH` |
| `headerSpill` | **12** | 10 | regex *under*-counted; excluded from `geom` (§3) — container sizing, not geometry |
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

1. **Add `geom` and one regression test.** Build it in `init()`, **after** the
   three scale assignments at `925`/`932`/`935` (§3's construction contract). Use
   it nowhere yet. The first draft proposed asserting `geom`'s fields equal the
   closure bindings — unwritable (the closure is not observable, per CLAUDE.md)
   and vacuous where writable (`geom.xScale === xScale` is `a === a`). Instead,
   following `test/e2e/67-extraction.spec.js`, pin the **distinctive failure
   mode**: create a level, `nv.destroy()`, and assert that nothing reachable
   through `geom` still references the pre-destroy `yScales` array (§3's
   getter-vs-value contract, tested directly rather than trusted). Add the first
   **unit** test of navio geometry: construct `geom` with fake scales and assert
   horizontal/vertical transposition, and assert `attribAtA`/`rowAtR` invert what
   `cellA`/`cellR` produced.
2. **Convert `drawLevelBorder`.** Geometry-only, no instance state. Proves the
   forward half of the interface.
3. **Convert the handlers.** `columnAtPointer`, `dropTargetFor`,
   `showDropIndicator` (all `attribAtA`), `showTooltip` (`attribAtA` and
   `rowAtR`), `restoreBrushes` (`cellR`, `bandwidthR`). These are the sites §3's
   inverse methods exist for — do them once that interface is in place, not
   before. `updateBrushes` itself is bound to the DOM via
   `levelOverlayEnter.each(updateBrushes)` (`2655`, `2657`), which relies on
   d3's `.each()` supplying `this`; threading `geom` through requires
   `.each(function (d, i) { updateBrushes.call(this, geom, d, i); })` or
   equivalent, not a bare arrow function, or the `this`-bound `d3.select(this)`
   inside `updateBrushes` (`1671-1672`) breaks. **`drawBrushes` is not itself a
   conversion target but must change** — it is the caller that currently
   invokes `updateBrushes` via `.each` and is where `geom` first gets threaded
   downward.
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

**On step 7's safety, corrected.** `eslint.config.js` uses `js.configs.recommended`,
which sets `no-undef: error`, so deleting `let yScales` with a bare reader left
behind **fails `npm run check`**. That guarantee is real but narrow: it covers
bare identifiers only. A typo in the *new* form — `geom.yScale` — yields
`undefined`, then `NaN`, which d3 writes into an SVG attribute and the browser
rejects silently: console errors per redraw, no exception, no failing test.
That is CLAUDE.md's "hiding every column" failure mode.

**`Object.freeze(geom)` was proposed as the second mitigation for that typo and
is withdrawn — it does not do what was claimed.** Verified:

```
node -e '"use strict"; const g=Object.freeze({pixelRatio:()=>2});
console.log(g.pixelRato, g.pixelRato+1);'
// -> undefined NaN
```

`Object.freeze` blocks *writes* — reassignment, new properties, deletion. It
does nothing to a *read* of a missing property, which is exactly the typo it was
proposed to catch; frozen or not, `g.pixelRato` is `undefined`. The one thing
freezing `geom` actually buys is throwing if a renderer *writes* to it (e.g.
`geom.pixelRatio = 2`) — a real but different and unstated benefit, worth
keeping for that reason alone but not as typo protection.

The one mitigation that does work is the **whole-identifier codemod**: convert
every genuine reference of a geometry identifier to `geom.<name>` mechanically,
never by hand, so there is no typing step to typo. Verify the codemod's own
correctness against the shadowing hazard noted in §4 (the `x` parameter in
`invertOrdinalScale`, `1000`) before running it — a blind text substitution
would corrupt that function.

Note also that `nv.destroy` **rebinds** `yScales = []` (`4115`); step 7 must
settle teardown ownership, not just readers, and step 1's regression test is
what pins that this is actually safe under `geom`.

**Independence.** Steps 2–6 are individually revertible, with two
qualifications. First, `drawBrushes` (`2641-2665`) calls `drawAttributesHolders`,
`drawCounts` and `drawFilterExplanationsHTML` from one place, so steps 5 and 6
cut through a single call site; reverting one leaves `drawBrushes` passing
`geom` to some children and not others — mechanically fine, not fully clean.
Second, step 3 depends on step 1 having shipped the inverse methods
(`attribAtA`, `rowAtR`, `bandwidthR`) correctly; it cannot be attempted against
a `geom` that only has the forward half.

---

## 9. Directory map

Domain vocabulary, per the maintainer's decision. **Size is not a criterion.**

```
src/
  navio.js          the facade and instance-state kernel: the ~40 public nv.*
                    methods, the let chain, init(), and the update pipeline
  geometry.js       createGeometry: toXY, toWH, isVertical, cellA, cellR,
                    extentA, recordExtent, recordAxisStart, bandwidthR,
                    pixelRatio, snapToDevice, and the inverse pair attribAtA,
                    rowAtR. headerSpill and explanationsPad stay in navio.js -
                    container sizing, not geometry (§3).
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

## 12. What the second draft got wrong

A second independent review, run against §§1–11 as they stood after the first
rewrite, found the interface itself incomplete rather than the reasoning around
it. Kept for the same reason as §11.

| # | Defect | Cause |
| --- | --- | --- |
| 1 | `geom`'s interface was entirely forward-mapping; its own named step-3 targets (`columnAtPointer`, `showTooltip`, `dropTargetFor`, `restoreBrushes`) all need the inverse | Verified the mechanism fixed the staleness problem the first review found, never checked whether the interface covered the call sites the mechanism was justified by |
| 2 | `Object.freeze(geom)` proposed as protection against a read-typo | Freeze blocks writes, not reads of a missing property; `g.pixelRato` is `undefined` whether or not `g` is frozen — never tested the claim |
| 3 | No stated contract for how `createGeometry` itself must capture `xScale`/`yScales`/`pixelRatio` | Asserted "methods read live state" without saying how, reproducing by omission the exact "module gets values, not getters" bug this repo already shipped once |
| 4 | `headerSpill` kept in `geom` while `explanationsPad` was excluded by the same test | Applied the membership test to one candidate and not its structural twin |
| 5 | Overclaimed that `geom`'s liveness fixes a stale `isVertical` after an orientation flip | The actual mechanism is `nv.hardUpdate()` defaulting `recomputeBrushes: true` and rebuilding the brush; `geom`'s real benefit is narrower and was understated as a result |
| 6 | `x` reference count off by one (13 vs 12) | The acorn script's declared-vs-referenced split did not perfectly separate a shadowing parameter from its use |
| 7 | `.each(updateBrushes)` → threading `geom` through described as a five-item list with no mention of the `this`-binding it depends on | Named the functions to convert, not the mechanics of the call site that invokes them |
| 8 | `computeRepresentatives`/`dataIs[level].representatives` compared directly to the #88 landmine | Did not check that `nv.getRowsAtLevel` returns a fresh array — the caller never sees the stashed properties, so the comparison overstated the tension |

Two things the second review confirmed hold up without qualification: the
`invertScaleCache` correction in §2, and the sequencing discipline and
`no-undef` safety net in §8 (narrowed, not invalidated, by the freeze
correction above).

## 13. Out of scope

- Vertical layout (#22).
- Any change to the filtering model or the public API.
- Moving `computeRepresentatives` (§3) — flagged, deferred to `records/`.
- Unit tests for `settings-storage.js` / `settings-panel.js` (#108) and the
  `initSettingsPanel` teardown bug (#109).
- Making navio declarative. Only Plot's discipline is adopted — derived state is
  produced and passed rather than reached for — not its statelessness.
