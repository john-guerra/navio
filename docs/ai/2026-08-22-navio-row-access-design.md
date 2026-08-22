# Row identity, and the attribute primitives (2026-08-22)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `fef7c6a`. Follows
`docs/ai/2026-08-21-navio-canvas-renderer-design.md`, whose §3.2 named this
seam: nine of the canvas module's context entries are one idea.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** implemented. See
`docs/superpowers/plans/2026-08-22-navio-row-access.md` (Tasks 1-5) for what
landed and where it diverged from this design — in particular §6, corrected
mid-execution after the step-3 measurement disproved part of its risk model.

**Revision note.** An adversarial review of the first draft confirmed the
central architectural argument (§3) but found six factual errors and one
mis-scoped risk. Corrected here; §11 records what was wrong, because two of the
errors are the kind that would have produced a green build and a wrong
conclusion.

## 1. What this is for

`src/navio.js` is 3,995 lines. Four modules — `attribs.js`, `render/canvas.js`,
`chrome/settings-panel.js`, `filters.js` — receive row- and attribute-access
helpers from it, and the same handful appear in most of them. Every module
extracted so far has had to be handed them again.

This phase stops that. It moves the primitives to where a module can `import`
them, and collects the stateful row bookkeeping into one place that owns its own
state.

The point is not primarily the line count in `navio.js`. It is that the *next*
extraction starts from a smaller context.

## 2. The groups, and which ones move

The canvas design's §3.2 named nine entries as "one idea". They are not one
idea, and they are not nine — the set it listed mixed functions with the data
they read. Sorted by what they actually are:

| group | members | closure state | disposition |
| --- | --- | --- | --- |
| **Pure** | `getAttribName`, `getAttrib`, `isMissing` | none (`getAttrib` reads `nv.DEBUG`, nothing else) | move to `src/utils.js` as plain exports |
| **Row identity** | `idOf`, `attribAt`, `posAt`, `indexOfRow`, `assignIndexes`, and the open-coded resolution in `nv.setSelectedRows` | **owns** `posByLevel`, `rowIndex`; reads `data`, `id`, `selectedFlags` | new `src/rows.js` |
| **Colour-scale domains** | `extentAt`, `distinctAt` | reads `dataIs[0]` | **deferred** — an `attribs.js` concern |
| **Render level-of-detail** | `computeRepresentatives` | reads `dataIs`, `height`; writes `dataIs[n].itemsPerpixel` and `.representatives` | **deferred** — a separate concern again |

Two of the nine are not functions at all: `data` and `selectedFlags` are state,
and they **remain** context entries of the modules that read them. A third,
`visibleAttribs`, reads `attribsOrdered` and `hiddenAttribs` (`navio.js:1211`) —
attribute visibility, which is `attribs.js`'s domain, not this one. It is not
part of this phase.

**On the two deferred rows.** The first draft called them one group, "level
aggregation". That was sorting by proximity — the exact move this document
condemns two paragraphs later. `extentAt` and `distinctAt` exist solely to build
colour-scale domains (`navio.js:2888-2910`) and probably belong inside
`attribs.js`. `computeRepresentatives` is render level-of-detail, called once
(`:3001`), and annotates the level chain. They are two later phases, not one,
and neither is this one.

## 3. Why a writing module is still a good seam

The previous phase's criterion was that the canvas group **reads only**, where
the SVG group reads, mutates and re-enters the pipeline. This group writes:
`assignIndexes` writes `posByLevel`, and `indexOfRow` populates a lazy
`rowIndex` cache.

That does not make it the SVG case. An AST scan of every assignment in
`src/navio.js`, resolving each write to its innermost enclosing function:

| binding | written by |
| --- | --- |
| `posByLevel` | declaration `:145`, `assignIndexes` `:1390`/`:1392`, `nv.data` `:3432`, `nv.destroy` `:3913` |
| `rowIndex` | declaration `:146`, `indexOfRow` `:1330`, `nv.data` `:3435`, `nv.destroy` `:3914` |
| `selectedFlags` | declaration `:144`, `applyFilters`' callback `:1455`, `deleteSubsequentLevels` `:3068`, `nv.data` `:3431`, `nv.destroy` `:3912` |

`posByLevel` and `rowIndex` have no writer outside this group and the two
lifecycle sites. They do not get passed in; they **move in**. `selectedFlags` is
written by `applyFilters` and `deleteSubsequentLevels`, neither of which is in
this group, so it stays a read.

**The test is not read-versus-write, it is whether the writes stay inside the
boundary.** `assignIndexes` writing state the module owns is encapsulation. The
SVG group calling `applyFiltersAndUpdate` is re-entrancy. Same verb, opposite
consequence.

## 4. What each piece becomes

### 4.1 The pure three, in `src/utils.js`

`utils.js` already holds attribute-accessor mechanics (`convertAttribToFn`,
`getAttribsFromObjectAsFn`, `getAttribsFromObjectRecursive`), imports nothing,
and is a clean leaf. These belong beside them.

```js
export function getAttribName(attrib)          // unchanged
export function isMissing(v)                   // unchanged
export function getAttrib(item, attrib, debug) // NEW third parameter
```

**`getAttrib` is passed by value, not only called.** This is the trap in this
phase. `navio.js` hands the bare function into the five filter factories at
`:1698`, `:1710`, `:1794`, `:1801`, `:3539`, plus `:1300` and `:3399`, and
`src/filters.js` invokes it with **two** arguments at `:96`, `:100`, `:107`,
`:128`, `:132`, `:139`, `:172`, and through the derived `getAttribAt` at `:18`
and `:212`. A third parameter therefore arrives as `undefined` on every filter
path, silently disabling the log there — and nothing tests a `console.log`, so
it would land green.

So `navio.js` must hand the filter factories a **bound wrapper**, not the bare
import:

```js
const getAttribDebug = (d, a) => getAttrib(d, a, nv.DEBUG);
```

`nv.DEBUG` is read **inside** the wrapper, at call time. It must not be captured
at construction: `CLAUDE.md` states that `nv.DEBUG = true` is expected to work
after construction, so a captured flag would kill tracing for every runtime
toggle.

`getAttribName` has 19 call sites in `navio.js` alone and is consumed through
the context by `attribs.js`, `canvas.js` and `settings-panel.js`. It is the
single highest-leverage move in this phase.

### 4.2 `src/rows.js`

```js
export function createRows(ctx) { ... }
```

Returns `{ idOf, attribAt, posAt, indexOfRow, idFromRow, assignIndexes,
initForData, clear }`.

It owns `posByLevel` and `rowIndex` outright — declared inside the factory, not
passed in. Its context is `{ nv, get data(), get id(), get selectedFlags() }`;
all three cross as getters, since each is reassigned on `nv.data()` and
`nv.destroy()` and `id` also by `nv.id()`. `nv` is never rebound and crosses as
a plain value, per `CLAUDE.md`'s rule.

**`idFromRow(row)`** absorbs the sixth open-coded identity resolution, currently
inline in `nv.setSelectedRows` (`navio.js:3666`):

```js
const v = id !== "__seqId" ? getAttrib(r, id) : indexOfRow(r);
```

That is *resolve a row to its identity* — this module's defining idea,
implemented one more time in `navio.js`. It moves; `setSelectedRows` keeps its
own warning and unresolved-count logic, which is presentation, not identity.

**Two reset operations, not one.** The first draft specified a single `reset()`.
That was wrong: the two existing sites do different things.

```js
initForData()  // navio.js:3432 - posByLevel = [identity Int32Array over data]
clear()        // navio.js:3913 - posByLevel = [], rowIndex = null
```

`nv.data()` *initialises level 0 to identity*; `nv.destroy()` *empties*. A
single no-arg `reset()` cannot be both, and deriving the first from the `data`
getter would silently depend on `data` having been reassigned first. Two named
methods, and `initForData()` documents that it must be called after `data` is
set.

The consolidation is still worth doing — the reset rule belongs with the state
it resets — but only once it stops pretending the two sites are the same.

### 4.3 The payoff

Counted from the four context literals in `navio.js` (`:938`, `:1224`, `:1276`,
`:3384`):

| module | ctx entries now | after §8 step 3 | after §5 |
| --- | --- | --- | --- |
| `src/render/canvas.js` | 17 | 12 | 10 |
| `src/attribs.js` | 10 | 8 | 8 |
| `src/chrome/settings-panel.js` | 13 | 12 | 12 |
| `src/geometry.js` | 6 | 6 | 6 |
| **total** | **46** | **38** | **36** |

Each module drops the pure functions (importing them instead) and collapses
several row helpers into one `rows` entry. `canvas.js` reaches 10 only if §5
lands, since `ctx.data` and `ctx.selectedFlags` appear there **only** inside
`drawItem`.

(The 46 → 38 row counts only the four *consumer* modules above. `rows.js`
itself introduces its own 4-entry context — `{ nv, data, id, selectedFlags }`
— so the honest branch-wide net is 46 → 42. The next phase should not inherit
38 as its baseline.)

## 5. The deduplication this exposes, and why it is gated

`drawItem` (`src/render/canvas.js:124-129`) contains this:

```js
const val =
  attrib === "selected" ? !!selectedFlags[rowIdx]
  : attrib === "__seqId" ? rowIdx
  : getAttrib(item, attrib);
```

`attribAt(index, attrib)` (`navio.js:1193-1200`) is the same three-way branch,
line for line — confirmed by direct comparison, not assumed. Consolidating
`drawItem` onto `rows.attribAt` would also let it drop `data`, `selectedFlags`
and `getAttrib` from its context entirely.

**It is not obviously free**, and §6's rule applies. See §6.

## 6. The performance constraint, and why it binds step 3 as well as step 4

This is the correction the review mattered most for. The first draft gated only
the §5 consolidation. That was the wrong step to worry about first.

**`rows.js` is called from inside other people's loops, and cannot hoist.** The
canvas phase could obey *"destructure at entry, never in the loop"* because it
**owned** its loops. This module does not:

| caller | frequency |
| --- | --- |
| `idOf`, in `drawItem` (`canvas.js:141`, `:165`) | **twice per attribute per row** |
| `attribAt`, in the sort comparator (`navio.js:1025-1026`) | **twice per comparison**, O(n log n) |
| `attribAt`, in `extentAt` (`:2827`) and `distinctAt` (`:2870`) | O(n) per attribute per load |
| `idOf`/`indexOfRow`, in `drawLink` (`canvas.js:195`, `:198`) | per link |

**Correction, after step 3 was measured.** The table above states the *call*
frequencies correctly but overstates what step 3 actually exposes, and the
measurement made that visible. Two corrections, recorded because the next phase
would otherwise inherit the same wrong model:

- **`drawItem` hoists `idOf` once per row**, not per cell
  (`canvas.js:110`, `const idOf = ctx.rows.idOf`). The *calls* are twice per
  attribute per row and their cost is unchanged; only the one-time reference
  acquisition gained a property hop. So step 3's real cost on this path is one
  extra hop per row, not per cell — predicted to be invisible, and it was.
- **The O(n log n) sort comparator was never in step 3's blast radius.** It
  reads `rows.attribAt` directly off the closure (`navio.js:1026-1031`), not
  through `attribs.js`'s context. The only `attribAt` site step 3 touched is
  `attribs.js:78`, which runs once per attribute at declaration time. The
  benchmark therefore says nothing about the `attribs.js` half of step 3 —
  correctly, because that half was never hot.

**Step 4 is the step this section was really about.** It puts `attribAt` behind
a cross-module call *per cell*, inside `drawItem`'s attribute loop. That is a
genuine per-cell change and the gate there is load-bearing in a way step 3's
was not.

Issue [#111](https://github.com/john-guerra/navio/issues/111) measured 7.7-8.5%
on this exact path from turning direct closure reads into method calls, and its
fix recovered about a third. Step 3 is the same class of change, on the same
paths, and a caller that cannot hoist has nothing to amortise the getter reads
against.

**So both step 3 and step 4 are benchmark-gated**, using the harness the canvas
phase built (`test/e2e/fixtures/perf.html?n=20000`, 100 `hardUpdate()` calls,
medians of 5, warmup discarded, A/B/A ordering, rebuild before every
measurement, and confirm the server is serving this repo).

**If step 3 regresses**, the fallback is a *push* model rather than getters:
`rows.js` holds `data`, `selectedFlags` and `id` as plain locals set through
`setData(data, selectedFlags)` and `setId(id)`. Those bindings are reassigned at
exactly `:71`/`:3429`/`:3911`, `:144`/`:3431`/`:3912` and `:131`/`:3808` — the
same sites `initForData()`/`clear()` are already called from, so no new call
site has to be remembered. The cost is that it trades a structurally-safe
pattern for a remembered one, against `CLAUDE.md`'s explicit "a module gets
GETTERS, not values" rule. **Getters are the default and the fallback is taken
only on a measurement**, never pre-emptively.

**If step 4 regresses**, keep `drawItem`'s branch inline and add a comment
naming `attribAt` as the shared definition and the measurement as the reason.
Deliberate, documented duplication on a measured hot path is a legitimate
outcome; silent duplication is not.

`CLAUDE.md`: *measure performance claims; do not reason about them.*

## 7. What must not change

- **No API change.** `nv.data()`, `nv.id()`, `nv.destroy()`,
  `nv.setSelectedRows()` behave identically.
- **`getAttrib`'s error path.** With `debug` false it must still swallow the
  exception and return `undefined`; with it true, log the same message — on
  *every* path, including through `filters.js` (§4.1).
- **`indexOfRow`'s cache must stay lazy and stay invalidated.** It builds a
  `WeakMap` over `data` on first use and is nulled whenever `data` is replaced.
  Moving the function must not change when that happens.
- **`posByLevel` stays an `Int32Array` per level, allocated on first use.** It
  exists because `__seqId` used to be a property on every row (#88), and
  `CLAUDE.md`'s "Navio never writes to the caller's rows" landmine is precisely
  about this surface.
- **`attribAt` must keep resolving `__seqId` and `selected`.** Reading
  `row["__seqId"]` directly returns `undefined` — that is how a serialized brush
  silently failed to rebuild.

## 8. Sequencing

1. **The pure three into `src/utils.js`**, with unit tests, including the
   `debug` parameter and the bound wrapper for the filter factories (§4.1).
   Update every caller in `navio.js` and drop the entries from the `attribs.js`,
   `canvas.js` and `settings-panel.js` contexts. No state moves.
2. **Build `src/rows.js`** — context, owned state, `initForData`/`clear`,
   `idFromRow` — with unit tests. `navio.js` delegates and deletes its copies.
   **Depends on step 1**: `idOf` and `attribAt` call `getAttrib`, which is not
   in `rows.js`'s context and must already be importable.
3. **Thread `rows` through the three module contexts**, replacing the individual
   entries. Touches `test/unit/canvas-renderer.test.js`, whose fake context
   supplies `idOf`/`getAttrib` (`:46-47`). **Benchmark-gated** (§6).
4. **Benchmark-gated**: consolidate `drawItem` onto `rows.attribAt`, or document
   the duplication with the measurement that justifies it (§5, §6).
5. Update `CLAUDE.md`'s Layout block.

**Placement constraint for step 2.** `const rows = createRows(...)` is a
temporal-dead-zone binding, and the canvas context literal at `navio.js:1276` is
evaluated eagerly. The construction must appear **textually before** that line.
Its own context needs only top-of-closure `let`s, so around `:1150` works. The
five functions it replaces are hoisted declarations today, so nothing warns you
if this is got wrong — it throws at construction. `CLAUDE.md`'s "construct the
panel where the slice was, never at the top of the closure" landmine is the same
class of ordering trap.

## 9. Testing

Unlike the canvas phase, most of this **is** unit-testable, and that is the main
testing win on offer.

- `src/utils.js`'s three new exports are pure: direct unit tests, no fixture.
  `getAttrib`'s function-accessor throw path needs testing with `debug` both
  true and false, and the bound wrapper needs a test that a runtime
  `nv.DEBUG = true` takes effect (the capture-at-construction bug in §4.1).
- `src/rows.js` owns its state and its context is three entries, so a fake is
  cheap. Cover `idOf` for both the `__seqId` and real-id cases, `attribAt` for
  all three branches, `indexOfRow` for number/object/absent **and that its cache
  is invalidated**, `assignIndexes`/`posAt` as a round trip, `idFromRow` for
  both id modes, and `initForData`/`clear`.
- **Pin the getter contract from both sides.** The canvas phase shipped a header
  comment claiming coverage that did not exist: its unit tests built their own
  context with getters, which verifies the module re-reads but says nothing
  about `navio.js` supplying getters. Mutation-testing `navio.js`'s context
  literal found three entries no test caught. For `rows.js`, pin the module side
  in unit tests and state plainly in the header which entries are held by
  contract alone.
- The existing 293 e2e specs are the regression net for everything else.

## 10. Risks

- **The hot path regresses at step 3 or step 4.** Gated by measurement with a
  stated fallback for each, so the failure mode is a recorded decision rather
  than a silent slowdown.
- **The `filters.js` by-value path is missed**, and `debug` arrives `undefined`
  there. Named in §4.1; nothing tests console output, so this must be handled by
  construction rather than caught by the suite.
- **`rowIndex` invalidation is missed in the move**, producing stale row lookups
  after `nv.data()`. The subtlest state here; its unit test is not optional.
- **TDZ at step 2** if `createRows` is constructed after `:1276` (§8).

## 11. What the first draft got wrong

Recorded because two of these would have produced a green build and a wrong
conclusion, and because the next phase will be tempted by the same mistakes.

1. **`getAttrib` is passed by value into `filters.js`.** The draft added a third
   parameter and claimed behaviour was preserved. It would not have been, on the
   largest consumer of this group, and no test would have failed. → §4.1.
2. **The hot-path gate was on the wrong step.** The draft gated only the §5
   consolidation, missing that step 3 alone puts getters underneath `drawItem`'s
   per-cell `idOf` and the O(n log n) sort comparator — and that unlike the
   canvas phase, the callee cannot hoist. → §6.
3. **`reset()` conflated two different operations.** `nv.data()` initialises
   level 0 to identity; `nv.destroy()` empties. → §4.2.
4. **The `id` risk was struck through on a miscount.** The draft's AST scan
   counted member-property nodes (`out.id`, `nv.id`) as reads of the closure
   binding and reported "2 in `idOf`, 12 at top level". There are 9 reads in
   **four** functions: `idOf`, `nv.getFilters`, `nv.setSelectedRows`, `nv.id`.
   The conclusion held, but one of those reads was a sixth open-coded identity
   resolution that the draft left behind without noticing. → §4.2's `idFromRow`.
5. **Steps 1 and 2 were called independent.** Step 2 depends on step 1. → §8.
6. **The counts were wrong and the section was called "measured".**
   `canvas.js` has 17 context entries, not 18 — the draft's script counted a
   `ctx.x` occurring inside a comment. Totals were 46 → 38, not 47 → 39, and the
   "after" was pessimistic by two. → §4.3.
