# Deriving and passing the frame — a Plot-inspired data flow for navio (2026-08-21)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `650b2e7`. Follows
`docs/ai/2026-08-20-navio-decomposition-design.md`, which extracted the settings
panel, storage, theme and attributes and established the module mechanism.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** design only. Nothing here is implemented.

---

## 0. Summary

`src/navio.js` is 4,185 lines. Extraction by topic has stalled: the settings
slice scored 48 lines moved per unit of interface, attributes 34, and everything
remaining scores **17 or below**. The reason is not that the remaining code is
badly organised — it is that navio's renderers reach into eight shared geometry
bindings, so any boundary drawn around them has a wide interface by construction.

This design changes the data flow rather than the file layout. Derived geometry
stops being read from closure bindings and starts being **produced once per
update and passed as an argument**, following Observable Plot. The organising
principle is Plot's; the vocabulary and the partition are navio's.

Two decisions taken by the maintainer and treated as settled here:

1. **Semantics lead, size follows.** Module boundaries are chosen by the concept
   they own. Interface measurements estimate cost and expose coupling; they never
   select the boundary. The ~800-line target from the previous design is
   **withdrawn** — Plot's own `plot.js` is 28KB and `marks/axis.js` is 23KB.
2. **The directories speak navio's domain language**, not Plot's chart language:
   `attributes/`, `records/`, `levels/`, `filtering/`, `chrome/`. A maintainer
   reading `FILTERING-MODEL.md` should find a directory with that name.

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

Plot's `plot()`: normalise options -> `createScales` -> `createDimensions` ->
`mark.render(index, scales, values, dimensions, context)`.

Same three phases. The only difference is that navio **stores** what it derives
and every renderer reaches for it, where Plot **returns** it and every renderer
receives it. That single difference is what makes the remaining extractions
expensive.

---

## 2. Three corrections to the obvious translation

Each of these was found by measuring, and each rules out a plausible design.

**Scales are created once and mutated in place.** `xScale`, `levelScale` and `x`
are assigned at `src/navio.js:925`, `932` and `935` — inside `init()` — and never
reassigned. `updateScales` reconfigures them with `.domain(...)` / `.range(...)`.
That is ordinary d3: a scale is a long-lived stateful function object. So "return
fresh scales each update", the literal Plot translation, is **not** what this
design does.

**And it must not be.** `invertScaleCache` is a `WeakMap` keyed on scale
*identity* — the tooltip memoisation from #62. Creating fresh scale objects per
update would silently miss that cache on every update. That is a measurable
regression, not a matter of taste.

**`height` is not derived.** It is written at `src/navio.js:3924` (the `nv.height`
setter) and `1268` (settings restore). It is user intent and belongs to the
instance. It appears in the frame as a *read-only copy* for renderers, never as
the authoritative value.

---

## 3. The frame

### Definition

The **frame** is navio's coordinate system for one update. Membership test, and
it is the whole test:

> Does this field help answer "given an attribute and a record, where on screen
> is that, and how big?"

If yes it is frame state. If no it is instance state. `headerSpill` and
`explanationsPad` pass — they are the offsets that make the answer correct.

### Contents

```js
// produced by the derive phase, consumed by every renderer
frame = {
  // the long-lived scale objects, configured for this update.
  // IDENTITY IS PRESERVED across updates - invertScaleCache depends on it.
  xScale,          // attribute axis (a band scale over visible attribute names)
  yScales,         // record axis, one per level
  levelScale,      // level axis
  x,               // x(val, level) - attribute position within a level

  // orientation and the two mappings every piece of geometry goes through
  isVertical,      // boolean, not the function
  toXY,            // (a, r) -> {x, y}
  toWH,            // (a, r) -> {width, height}

  // sizes and offsets
  height,          // read-only copy of the instance's record extent
  width,           // levelScale.range()[1] + nv.margin + nv.x0
  headerSpill,     // header overflow above the widget
  explanationsPad, // pixels the filter chips need below the canvas
  pixelRatio,      // device pixels per CSS pixel
};
```

### Why one object rather than Plot's two

Plot passes `scales` and `dimensions` separately because in a chart they are
separate concerns. In navio they are one: `CLAUDE.md` records that **all geometry
goes through `toXY()`**, and `toXY` needs the orientation, the axis scales and
the offsets together. `toXY` is called 22 times and `toWH` 8. Splitting the frame
would leave `toXY` straddling both halves, which is a boundary through the middle
of a concept.

Taking Plot as inspiration means taking its discipline — derived state is
produced and passed, never reached for — not copying a partition that does not
fit this domain.

### What the frame is NOT

Not a general state object. `data`, `dataIs`, `filtersByLevel`, `dSortBy`,
`hiddenAttribs`, `selectedFlags`, `dBrushes`, `colScales`, `attribsOrdered` are
**instance state**: persistent user intent, unchanged by this design. A renderer
that needs them receives them as its own arguments, so its signature says what it
reads.

`context`, `canvas`, `svg`, `divNavio` are **ambient chrome**, Plot's actual
`context` — which is 376 bytes and holds `{document, clip}`. They travel
separately from the frame, because a mark that only computes geometry should not
be handed a drawing surface.

---

## 4. Scale of the change

Comment- and string-stripped reference counts in `src/navio.js` (see §8 on how
these were counted, and on a tool that got them wrong):

| Identifier | Refs | | Identifier | Refs |
| --- | ---: | --- | --- | ---: |
| `yScales` | 53 | | `isVertical` | 23 |
| `x` | 39 | | `toXY` | 22 |
| `xScale` | 30 | | `levelScale` | 21 |
| `height` | 21 | | `headerSpill` | 10 |
| `toWH` | 8 | | `pixelRatio` | 7 |
| `posByLevel` | 7 | | `visibleLinks` | 5 |
| `posAt` | 5 | | `explanationsPad` | 4 |

Roughly **250 reference sites**, every one inside `src/navio.js`. None of the
four already-extracted modules touches any of them, which is a useful signal:
the frame is a genuine cluster, not an arbitrary cut.

---

## 5. Directory map

Domain vocabulary, per the maintainer's decision. **Sizes are not a criterion**;
each directory owns a concept.

```
src/
  navio.js          the facade and the instance-state kernel: the ~40 public
                    nv.* methods, the let chain, init(), and the update
                    pipeline that calls derive then render
  frame.js          builds the frame (§3) from instance state; owns toXY,
                    toWH, isVertical, posAt, snapToDevice
  attributes/       definition and typing (attribs.js, already extracted),
                    ordering, visibility, colour domains and scales
  records/          the record axis: drawing rows, representatives,
                    selection flags, row identity
  levels/           the level chain: borders, connections, links, counts
  filtering/        the filter algebra (filters.js, already extracted),
                    applying filters, brushes, chips
  chrome/           settings panel, theme, tooltip, loading, aria live region
                    (settings-panel.js, settings-storage.js, theme.js move here)
```

`scales.js`, `palettes.js`, `params.js`, `utils.js` stay at `src/` — they are
leaf utilities, not concepts of the widget.

**Moving the four existing modules into `chrome/` is a rename, and renames are
their own commit**, separate from any behaviour-relevant change.

---

## 6. What does not change

- **The public API.** Every `nv.*` method keeps its name, arity and behaviour.
  `src/params.js` stays the single description, `docs/ai/API.md` stays generated
  and unchanged.
- **`nv.update()` and `nv.hardUpdate()` keep their signatures.** They are public
  and take an options object. Internally they derive a frame and pass it down;
  externally nothing moves.
- **The UMD global stays a callable function.** `src/index.js` remains
  default-only.
- **Filtering semantics.** Filters are still evaluated once at creation;
  `applyFilters` still materialises `selectedFlags`; range filters still compare
  visual positions. Read `FILTERING-MODEL.md` before touching anything in
  `filtering/`. This design does not change the model, and any change that does
  is out of scope.

---

## 7. Sequencing

Each step is a separate commit, and each must pass `npm run check` **and**
`NAVIO_TEST_PORT=4190 npx playwright test` before the next begins. `npm run
check` does not run e2e.

1. **Build the frame, use it nowhere.** Add `frame.js`; `updateData` calls it and
   discards the result. Assert in a test that its fields equal the closure
   bindings they mirror. This is the step that proves the derive phase is
   complete and correct before any renderer depends on it.
2. **Convert one renderer.** `drawLevelBorder` — small, geometry-only, no
   instance state. Prove the pattern end to end.
3. **Convert the record renderers.** `drawItem`, `computeRepresentatives`,
   `posAt`. This is the hot path; §8 requires a measurement here.
4. **Convert the level renderers.** `drawLinks`, `drawLine`,
   `drawLevelConnections`, `drawCounts`.
5. **Convert the attribute-header renderers.** `drawAttribHeaders`,
   `drawAttributesHolders`, header band.
6. **Delete the geometry bindings from the `let` chain** once nothing reads them.
   This step is the payoff, and it is also the proof: if a binding cannot be
   deleted, a reader was missed.
7. **Move files into the directories** from §5. Pure renames.

Steps 2–5 are independently valuable and independently revertible. Step 6 is the
only one that cannot be partially done.

---

## 8. Verification

Behaviour-preserving throughout. The existing suite — 102 unit tests, 291 e2e —
is the specification.

**Measured, not reasoned.** Step 3 touches `drawItem`, which runs per
representative per level on every update. Turning closure reads into property
reads on a passed object is very probably free after JIT, but `CLAUDE.md` records
that this repo has twice reasoned wrongly about performance. Requirement: a
benchmark of at least 20,000 iterations before and after step 3, with the numbers
reported in the commit message. A 400-iteration benchmark showed nothing here
where 20,000 showed 31%.

**Guard the WeakMap.** A test must assert that `frame.xScale` is the *same
object* across two consecutive updates. If that ever fails, `invertScaleCache`
silently degrades and nothing else would catch it.

**The public-surface gate is `test/e2e/104-describe.spec.js`**, not a `docs:api`
diff — `API.md` is generated from `params.js`, which this work does not touch, so
that diff cannot fail.

**Counting references: use `node`, not `grep`.** In this environment `grep` is
aliased to `ugrep`, which silently returned **0** matches for `toXY` on a pattern
that returned correct counts for other identifiers. The true count is 22. Every
number in §4 was produced by a node script that strips comments and string
literals line-count-preservingly. The two rules from the previous design's §9
still apply and are the reason its first draft was rejected:

1. Strip comments and strings before counting, preserving line numbers.
2. Count reference sites, not assignment sites, and never require a following
   `(` — a function passed by identity is invisible otherwise.

---

## 9. Risks

**This is a wide change to the hot path.** ~250 reference sites, all in the one
file every landmine in `CLAUDE.md` is about. Mitigated by sequencing: no step
after 1 touches more than one renderer family, and step 6 fails loudly rather
than silently if a reader was missed.

**Rollup constant-folding.** Moving reads from closure bindings to properties of
a passed object changes what Rollup can prove. The direction is *less* provable,
so the expected effect is mild bundle growth, not the branch-deletion failure the
landmine describes. Record the bundle size at each step; the settings extraction
grew it 2.65%.

**The frame could become a god-object.** The membership test in §3 exists to stop
that, and it should be applied to every field anyone proposes adding. A field
that cannot be justified by "where on screen, and how big" is instance state.

**Orientation.** `nv.orientation = "vertical"` transposes the axes, and #22 is
still open. The frame carries `isVertical`, `toXY` and `toWH` together precisely
so a renderer cannot get this half-right — but this design does not implement
vertical layout and must not be read as doing so.

---

## 10. Out of scope

- Vertical layout (#22).
- Any change to the filtering model.
- Any change to the public API.
- Unit tests for `settings-storage.js` and `settings-panel.js` (#108) and the
  `initSettingsPanel` teardown bug (#109) — both filed, both independent.
- Making navio declarative. Plot re-renders from scratch; navio holds persistent
  brushes, filters and sort across interactions. Only Plot's *data flow* is being
  adopted, not its statelessness.
