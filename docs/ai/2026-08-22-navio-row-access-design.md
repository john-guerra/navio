# Row identity, and the attribute primitives (2026-08-22)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `fef7c6a`. Follows
`docs/ai/2026-08-21-navio-canvas-renderer-design.md`, whose §3.2 named this
seam: nine of the canvas module's context entries are one idea.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** design only. Nothing here is implemented.

## 1. What this is for

`src/navio.js` is 3,995 lines. Three modules — `attribs.js`, `render/canvas.js`,
`chrome/settings-panel.js` — each receive a context object from it, and the same
handful of row- and attribute-access helpers appear in all three. Every module
extracted so far has had to be handed them again.

This phase stops that. It moves the primitives to where a module can `import`
them, and collects the stateful row bookkeeping into one place that owns its own
state.

The point is not primarily the line count in `navio.js`. It is that the *next*
extraction starts from a smaller context.

## 2. The three groups, and why only two of them move

Measured at `fef7c6a`, the nine entries §3.2 named are not one idea but three.

| group | functions | closure state | disposition |
| --- | --- | --- | --- |
| **Pure** | `getAttribName`, `getAttrib`, `isMissing` | none (`getAttrib` reads `nv.DEBUG`, nothing else) | move to `src/utils.js` as plain exports |
| **Row identity** | `idOf`, `attribAt`, `posAt`, `indexOfRow`, `assignIndexes` | **owns** `posByLevel`, `rowIndex`; reads `data`, `id`, `selectedFlags` | new `src/rows.js` |
| **Level aggregation** | `extentAt`, `distinctAt`, `computeRepresentatives` | reads `dataIs`, writes `dataIs[n].itemsPerpixel` | **out of scope** |

The third group is about levels, not rows — it aggregates across `dataIs[0]` and
annotates the level chain. Grouping it here because it happens to live nearby
would be sorting by proximity rather than by meaning. It is a later phase's
problem.

## 3. Why a writing module is still a good seam

The previous phase's criterion was that the canvas group **reads only**, where
the SVG group reads, mutates and re-enters the pipeline. This group writes:
`assignIndexes` writes `posByLevel`, and `indexOfRow` populates a lazy
`rowIndex` cache.

That does not make it the SVG case. An AST scan of every assignment in
`src/navio.js` shows the writers of each binding:

| binding | written by |
| --- | --- |
| `posByLevel` | `assignIndexes` (elements), and the closure top level (declaration, reset in `nv.data()` and `nv.destroy()`) |
| `rowIndex` | `indexOfRow` (its own cache), and the closure top level (invalidation) |
| `selectedFlags` | `applyFilters`, `deleteSubsequentLevels` — **neither is in this group** |

`posByLevel` and `rowIndex` have no writer outside this group. They do not get
passed in; they **move in**. `selectedFlags` does have outside writers, so it
stays a read.

**The test is not read-versus-write, it is whether the writes stay inside the
boundary.** `assignIndexes` writing state the module owns is encapsulation. The
SVG group calling `applyFiltersAndUpdate` is re-entrancy. Same verb, opposite
consequence.

## 4. What each piece becomes

### 4.1 The pure three, in `src/utils.js`

`utils.js` already holds attribute-accessor mechanics
(`convertAttribToFn`, `getAttribsFromObjectAsFn`,
`getAttribsFromObjectRecursive`). These are the same family and belong beside
them rather than in a new file.

```js
export function getAttribName(attrib)          // unchanged
export function isMissing(v)                   // unchanged
export function getAttrib(item, attrib, debug) // NEW third parameter
```

`getAttrib` currently logs to the console when a function-valued accessor
throws, gated on `nv.DEBUG`. A plain export cannot read `nv`, so the flag
becomes an explicit third parameter. Callers pass `nv.DEBUG`. This preserves the
behaviour exactly rather than dropping a debugging aid the maintainer put there
on purpose, and it keeps the function pure.

`getAttribName` has 19 call sites in `navio.js` alone and is consumed through
the context by all three existing modules. It is the single highest-leverage
move in this phase.

### 4.2 `src/rows.js`

```js
export function createRows(ctx) { ... }
```

Returns `{ idOf, attribAt, posAt, indexOfRow, assignIndexes, reset }`.

It owns `posByLevel` and `rowIndex` outright — they are declared inside the
factory, not passed in. `reset()` replaces the two places `navio.js` currently
clears them by hand (`nv.data()` and `nv.destroy()`), so the reset rule lives
with the state instead of being remembered at two call sites.

Its context is small:

```
{ nv, get data(), get id(), get selectedFlags() }
```

All three cross as getters: `data` and `selectedFlags` are reassigned wholesale
on `nv.data()` and `nv.destroy()`, and `id` is reassigned by `nv.id()`. `nv`
itself is never rebound and crosses as a plain value, per `CLAUDE.md`'s rule.

### 4.3 The measured payoff

| module | ctx entries now | after |
| --- | --- | --- |
| `src/render/canvas.js` | 18 | ~13 |
| `src/attribs.js` | 10 | 8 |
| `src/chrome/settings-panel.js` | 13 | 12 |
| `src/geometry.js` | 6 | 6 |
| **total** | **47** | **39** |

Each module drops the pure functions (it imports them instead) and collapses
several row helpers into one `rows` entry.

## 5. The deduplication this exposes, and why it is gated

`drawItem` (`src/render/canvas.js`) contains this:

```js
const val =
  attrib === "selected" ? !!selectedFlags[rowIdx]
  : attrib === "__seqId" ? rowIdx
  : getAttrib(item, attrib);
```

`attribAt(index, attrib)` in `navio.js` is the same three-way branch, to the
line. This is genuine duplication, and consolidating `drawItem` onto
`rows.attribAt` would also let it drop `data`, `selectedFlags` and `getAttrib`
from its context entirely.

**It is not obviously free.** `drawItem` runs once per representative row and
loops over every visible attribute; issue
[#111](https://github.com/john-guerra/navio/issues/111) measured that converting
direct reads into method calls on this exact path cost 7.7-8.5%, and the fix for
it recovered only about a third. Replacing an inlined branch with a cross-module
call per cell is the same class of change.

So it is a **benchmark-gated** step, not an assumed win, with a stated default:
if the measurement is neutral or favourable, consolidate; if it regresses, keep
`drawItem`'s branch inline and add a comment naming `attribAt` as the shared
definition and this measurement as the reason for the duplication. Deliberate,
documented duplication on a measured hot path is a legitimate outcome — silent
duplication is not.

`CLAUDE.md`: *measure performance claims; do not reason about them.*

## 6. What must not change

- **No API change.** No public method's signature moves. `nv.data()`,
  `nv.id()`, `nv.destroy()` behave identically.
- **`getAttrib`'s error path.** With `debug` false it must still swallow the
  exception and return `undefined`; with it true, log the same message.
- **`indexOfRow`'s cache must stay lazy and stay invalidated.** It builds a
  `WeakMap` over `data` on first use and is nulled whenever `data` is replaced.
  `CLAUDE.md`'s "do not cache resolved link endpoints" landmine is about a
  *different* cache, but the same discipline applies: `drawLink` calls
  `indexOfRow` per link precisely because link arrays are mutated in place.
  Moving the function must not change when the cache is invalidated.
- **`posByLevel` stays an `Int32Array` per level, allocated on first use.** It
  exists because `__seqId` used to be a property on every row (#88).
  `CLAUDE.md`'s "Navio never writes to the caller's rows" landmine is precisely
  about this surface.
- **`attribAt` must keep resolving `__seqId` and `selected`.** Reading
  `row["__seqId"]` directly returns `undefined` — that is how a serialized brush
  silently failed to rebuild.

## 7. Testing

Unlike the canvas phase, most of this **is** unit-testable, and that is the main
testing win on offer.

- `src/utils.js`'s three new exports are pure functions: direct unit tests, no
  fixture. `getAttrib`'s function-accessor throw path with `debug` both true and
  false is the one that needs care.
- `src/rows.js` owns its state, so its context is three entries and a fake is
  cheap. Test `idOf` for both the `__seqId` and real-id cases, `attribAt` for
  all three branches, `indexOfRow` for the number/object/absent cases **and that
  its cache is invalidated**, `assignIndexes`/`posAt` as a round trip, and
  `reset()`.
- The getter contract needs pinning **from both sides**. The previous phase
  shipped a comment claiming coverage that did not exist: its unit tests built
  their own context with getters, which verifies the module re-reads but says
  nothing about `navio.js` supplying getters. Mutation-testing `navio.js`'s
  context literal found three entries that no test caught. For `rows.js`, pin
  the module side in unit tests, and state plainly in the header which entries
  are held by contract alone.
- The existing 293 e2e specs are the regression net for everything else.

## 8. Sequencing

1. Move the pure three into `src/utils.js` with unit tests; add the `debug`
   parameter; update every caller in `navio.js` and the three module contexts
   to import instead. Largest single reduction, and it touches no state.
2. Build `src/rows.js` with its context, its owned state and its unit tests;
   `navio.js` delegates to it and deletes its own copies.
3. Thread `rows` through the three module contexts, replacing the individual
   entries.
4. Benchmark-gated: consolidate `drawItem` onto `rows.attribAt`, or document
   the duplication with the measurement that justifies it (§5).
5. Update `CLAUDE.md`'s Layout block.

Steps 1 and 2 are independent and each leaves the tree green; 3 depends on both.

## 9. Risks

- **The hot path regresses at step 4.** Gated by measurement with a stated
  default, so the failure mode is "we keep the duplication and say why", not a
  silent slowdown.
- **`rowIndex` invalidation is missed in the move**, producing stale row lookups
  after `nv.data()`. This is the one genuinely subtle piece of state here. The
  unit test for cache invalidation is not optional.
- ~~**`id` is read more widely than expected.**~~ **Checked and cleared.** An
  AST scan of every `id` identifier in `src/navio.js` finds reads in exactly two
  places: `idOf` (2), and the closure top level (12 — the declaration, the
  `nv.id()` setter and its neighbours). No other function reads it, so a getter
  on `rows.js`'s context is sufficient and `navio.js` keeps owning the binding.
