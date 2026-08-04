# How Navio's filtering actually works

Written for anyone — human or agent — about to touch filtering, sorting, or
selection in `src/navio.js`. Every claim here was verified by reading the code
and by measuring the running widget in a browser, not inferred.

It exists because a plausible-sounding mental model ("a filter is a predicate,
re-evaluated on every render") is **wrong**, and acting on it produces a design
that looks right and is not. Issues #81 and #82 were found purely by testing
this model instead of trusting it, and #79 - a lone negative filter emptying the
widget - came from working through the algebra in section 3.

---

## 1. The data structures

```js
data            // flat array of every row, EXACTLY as the caller passed them.
                // Navio does not write anything onto a row. It also never
                // sorts or splices this array, so a row's index in `data` is
                // a stable id for its whole lifetime.

dataIs          // array of arrays of INDICES INTO `data`, one entry per level
                //   dataIs[0] = every row
                //   dataIs[1] = the rows that survived level 0's filters
                //   dataIs[2] = the rows that survived level 1's filters
                // Sorting reorders THESE, never `data`.

posByLevel      // posByLevel[L] = Int32Array, indexed by row index, giving
                // that row's position within dataIs[L]. See below.

selectedFlags   // Uint8Array, indexed by row index. See §4.

filtersByLevel  // filtersByLevel[L] = the filters applied AT level L,
                // producing dataIs[L+1]

dSortBy         // dSortBy[L] = { attrib, desc } — the CURRENT sort of level L.
                // No history is kept. See §6.
```

**Navio adds no properties to your rows** (#88). Bookkeeping that used to live on
each row as `__i` (an array of per-level positions) and `selected` is now held in
the typed side tables above, and `__seqId` is gone entirely — it was always equal
to the row's index into `data`, so it is derived on demand by `idOf(index)`. This
keeps the caller's objects clean under `Object.keys`/`JSON.stringify`, lets two
Navios share one array without corrupting each other, and on 1M rows costs ~16MB
of heap instead of ~214MB.

**`posByLevel[L][i]` is row `i`'s position within `dataIs[L]`** — not a global
row id. It is written in exactly two places:

- `assignIndexes(filteredData, level + 1)` in `applyFiltersAndUpdate`
- `assignIndexes(dataIs[L], L)` at the end of `updateSorting`

so **re-sorting a level rewrites `posByLevel[L]` for every row at that level.**
Entries for rows that are not present at level `L` are meaningless, not zero-safe.

Because positions are no longer readable off a row, code outside navio observes
ordering through `nv.getRowsAtLevel(L)` and membership through
`nv.isSelected(rowOrIndex)`. Internally, filters are handed `(row, index)` plus
accessors — `posAt(index, level)`, `attribAt(index, attrib)` — rather than being
allowed to reach into the row for either.

`attribAt` is also what makes the derived `__seqId` readable: it maps that name
back to the index instead of doing a property lookup that would return
`undefined`. Anything resolving an attribute by row index must go through it —
`filterFromValue` reading `row["__seqId"]` directly is exactly how a serialized
brush silently failed to rebuild.

## 2. Levels are a drill-down chain

Each level filters the survivors of the one before it, which is what makes
"Adelie → Torgersen → beak 10-13" a chain rather than three independent filters:

```
dataIs[0]  all rows          --filtersByLevel[0]-->
dataIs[1]  Adelie            --filtersByLevel[1]-->
dataIs[2]  Adelie+Torgersen  --filtersByLevel[2]-->
dataIs[3]  ... which is what getSelected() reads
```

`getLastLevelFromFilters()` stops at the first level with no filters, so
**filters must be contiguous from level 0.** A payload with filters at level 2
but nothing at level 1 is silently truncated — validate before applying.

## 3. The logical algebra of one level

`applyFilters(level)` composes a level as **(OR of positives) AND (AND of
negatives)**:

| Level contains | Result |
|---|---|
| nothing | level not filtered (loop breaks) |
| positives only | OR of them |
| negatives only | everything except the excluded |
| positives + negatives | (OR pos) AND (AND neg) |

Positives OR together, negatives AND together. That asymmetry is intentional:
positives *add* candidates, negatives *subtract* from whatever is left.
`value`, `range` and `valueRange` are all positives; only `negativeValue` and
`negativeRange` are negatives. So two filters that should AND - say a species
and a beak range - belong on **separate levels**, not stacked on one.

The empty-positives row of that table was a bug (#79): an OR over an empty set
seeds to `false`, which is only correct when positives exist. A lone negative
filter emptied the entire widget. The positive term now seeds to `true` when
there are no positive filters — "start from everything at this level, then
subtract".

## 4. Filters are evaluated ONCE, at creation. This is the important part.

`applyFilters` has a side effect: it sets `selectedFlags[d]` for every row it
scans. `getSelected()`/`getVisible()` then just read that stored flag:

```js
nv.getSelected = function () {
  return dataIs[dataIs.length - 1]
    .filter((d) => selectedFlags[d])
    .map((d) => data[d]);
};
```

The flag used to be written onto the row as `d.selected`; it is a side table now
(#88), so ask `nv.isSelected(row)` rather than reading a property.

So **the selection is materialized state, not a live query.** Nothing re-runs
the predicate on redraw. `applyFilters` runs only from `applyFiltersAndUpdate`,
which fires on an actual filter action — a brush end, a click, closing a chip.

### The consequence, measured

`onSortLevel` (clicking a column header) calls `updateSorting` and
`nv.updateData`, and deliberately **never calls `applyFilters`**. Therefore
re-sorting a level cannot change which rows are selected — even though it
rewrites the `posByLevel[L]` values the range predicate is written against.

Verified in a browser (`rank` 1..6, `grp` alternating x/y):

| step | visual order | selected |
|---|---|---|
| sorted by `rank`, brushed 3 rows | `a b c d e f` | `b c d` |
| clicked the `grp` header | `a c e b d f` | `b c d` |

The selected rows are preserved **even though they are no longer contiguous**
(they land at visual positions 1, 3, 4).

### What a range filter therefore *means*

A brush is `d3.brushY()` spanning the level's full width — it selects **a band
of rows in the current visual order**, not a range within one column. Because
the level's ordering is whatever it was sorted by, and because ties resolve by
the previous order, a dragged range is generally **not** expressible as
`min <= attribute <= max` on any single attribute. Sorting by `species` and
dragging can yield "all 152 Adelie plus the first 6 Chinstrap".

> **A UI range filter is a materialized set of rows — the rows that fell under
> the pixels — with the boundaries being merely how it was authored.**

Do not model it as a live value range. A programmatic value range is a
genuinely *different* thing, and now **is** a distinct type:
`FilterByValueRange` (`type: "valueRange"`) compares raw attribute values, so
`beak in [38, 46]` means the same thing in any ordering. That is what an
external widget's range facet maps onto. The two are not interchangeable:
- **`range`** — a band of positions, what Navio's own brush produces. Invalidated
  by a re-sort, and only meaningful against the same rows in the same order.
- **`valueRange`** — a range over values. Portable, survives re-sorting, and
  cannot be produced by dragging.

`itemAttr` on a range filter is the level's **sort** attribute captured at
creation time, and it is read only by `toStr()` for the chip label — the
predicate itself never touches it. That is why the chip goes stale after a
re-sort (#82).

## 5. Notification

`updateCallback` is a **single overwritable slot**, called unconditionally at
the end of `applyFiltersAndUpdate`, `onSortLevel` and `deleteSubsequentLevels`.
It is the documented integration point, so **do not register library-internal
listeners on it** — doing so silently clobbers whatever the embedding app set.
Use **`nv.onChange(fn)`** instead: additive, multi-subscriber, returns an
unsubscribe function. `updateCallback` keeps firing on every change exactly as
before.

Because notification fires unconditionally, any programmatic filter application
will re-enter it. The guard is a `silent` flag threaded through `applySort`,
`applyFiltersAndUpdate` and `deleteSubsequentLevels` — it lives in the mutation
path, not in a wrapper, because a wrapper only covers one synchronous stack.
`nv.setFilters` applies every level silently and emits **once** at the end.

## 6. Serializing filter state

`nv.getFilters()` / `nv.setFilters(value)` round-trip the chain as one entry per
level, JSON-safe. Restoring walks the levels **in order**: a range is a band of
positions in a level's ordering, and that ordering only exists once the levels
above it have been applied, so each level's sort is re-established before its
boundaries are resolved.

Two things that are easy to get wrong here, both learned the hard way:

- **`filtersByLevel` can be sparse.** `deleteSubsequentLevels` returns early when
  the level is missing from `dataIs`, so an index can exist without ever being
  assigned. Anything iterating it by `length` must tolerate a hole - a level with
  no filters is not the same as a level that is absent. `getFilters` normalises
  holes to `[]` so no `null` ever reaches a serialized value.
- **Applying filters does not redraw the brush.** A restored range filters
  correctly but leaves nothing to grab, so `setFilters` maps each range back
  through its level's y scale and moves the brush. Without that, a widget synced
  from a peer looks filtered but is not draggable.

## 7. Traps that are not about filtering

- **`#levelN` is not unique across instances.** Level groups are identified by
  id, so with several Navios on one page `d3.select("#level0")` always resolves
  to the *first* instance and operates on the wrong widget. Go through
  `brushesOnLevel()`, which scopes to the instance's own container. Same family
  as the tooltip collision in #57 - assume any document-wide selector is a bug.
- **No sort history is retained.** `dSortBy[L]` holds only the current sort, yet
  ties resolve by the *previous* order (`Array.prototype.sort` is stable), so
  reproducing a visual ordering elsewhere may need the full history.
- **Fixed, but worth knowing the shape of:** `nv.sortBy()` used to update the
  header label without sorting (#81), and range chips kept naming the old sort
  attribute after a re-sort (#82, now suffixed "(re-sorted since)").

## 8. Rules of thumb

1. **Measure, don't infer.** Reading the source suggested filters are
   re-evaluated on sort; they are not. A ten-line Playwright probe settled in
   minutes what the reading got wrong.
2. **`selected` is state, not a derivation.** If you need it fresh, trigger a
   filter action; a redraw will not recompute it.
3. **Never assume a range filter is a value range.**
4. **Check exit codes, never grep output.** `npm run build` has failed while a
   grep for "error" matched nothing, and a stale `dist/` then made browser tests
   pass against yesterday's bundle. `npm ci` is also stricter than
   `npm install` about peer ranges, so verify dependency changes the way CI runs
   them.
5. **The bundler can change semantics.** Rollup constant-folded
   `obj.flag ? a : b` to `b` because it saw `flag` initialised to a literal and
   never reassigned *within the module* - the branch vanished from the bundle
   while the source looked right. Prefer a closure variable with an explicit
   setter over a mutable property when behaviour depends on it.
6. **Exercise both sides of a binding.** A test suite that only drives widget A
   programmatically will not find the crash that happens when someone interacts
   with the bound peer B.
