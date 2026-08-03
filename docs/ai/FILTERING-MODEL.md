# How Navio's filtering actually works

Written for anyone — human or agent — about to touch filtering, sorting, or
selection in `src/navio.js`. Every claim here was verified by reading the code
and by measuring the running widget in a browser, not inferred.

It exists because a plausible-sounding mental model ("a filter is a predicate,
re-evaluated on every render") is **wrong**, and acting on it produces a design
that looks right and is not. Two GitHub issues (#81, #82) were found purely by
testing this model instead of trusting it.

---

## 1. The data structures

```js
data            // flat array of every row. Navio adds two fields to each row:
                //   __i        an array of positions, one per level
                //   selected   a stored boolean, see §4

dataIs          // array of arrays of INDICES INTO `data`, one entry per level
                //   dataIs[0] = every row
                //   dataIs[1] = the rows that survived level 0's filters
                //   dataIs[2] = the rows that survived level 1's filters

filtersByLevel  // filtersByLevel[L] = the filters applied AT level L,
                // producing dataIs[L+1]

dSortBy         // dSortBy[L] = { attrib, desc } — the CURRENT sort of level L.
                // No history is kept. See §6.
```

**`__i[L]` is a row's position within `dataIs[L]`** — not a global row id. It is
written in exactly two places:

- `assignIndexes(filteredData, level + 1)` in `applyFiltersAndUpdate`
- `assignIndexes(dataIs[L], L)` at the end of `updateSorting`

so **re-sorting a level rewrites `__i[L]` for every row at that level.**

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

The empty-positives row of that table was a bug (#79): an OR over an empty set
seeds to `false`, which is only correct when positives exist. A lone negative
filter emptied the entire widget. The positive term now seeds to `true` when
there are no positive filters — "start from everything at this level, then
subtract".

## 4. Filters are evaluated ONCE, at creation. This is the important part.

`applyFilters` has a side effect: it sets `data[d].selected` for every row it
scans. `getSelected()`/`getVisible()` then just reads that stored flag:

```js
nv.getSelected = function () {
  return dataIs[dataIs.length - 1]
    .filter((d) => data[d].selected)
    .map((d) => data[d]);
};
```

So **the selection is materialized state, not a live query.** Nothing re-runs
the predicate on redraw. `applyFilters` runs only from `applyFiltersAndUpdate`,
which fires on an actual filter action — a brush end, a click, closing a chip.

### The consequence, measured

`onSortLevel` (clicking a column header) calls `updateSorting` and
`nv.updateData`, and deliberately **never calls `applyFilters`**. Therefore
re-sorting a level cannot change which rows are selected — even though it
rewrites the `__i[L]` values the range predicate is written against.

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
genuinely *different* thing and should be a distinct filter type (#60).

`itemAttr` on a range filter is the level's **sort** attribute captured at
creation time, and it is read only by `toStr()` for the chip label — the
predicate itself never touches it. That is why the chip goes stale after a
re-sort (#82).

## 5. Notification

`updateCallback` is a **single overwritable slot**, called unconditionally at
the end of `applyFiltersAndUpdate`, `onSortLevel` and `deleteSubsequentLevels`.
It is the documented integration point, so **do not register library-internal
listeners on it** — doing so silently clobbers whatever the embedding app set.
There is no `d3.dispatch` or `nv.on()` in the codebase; a multi-subscriber hook
has to be built (#60).

Because it fires unconditionally, any programmatic filter application will
re-enter it. Guard in the mutation path, not in a wrapper.

## 6. Known gaps, with issue numbers

- **`nv.sortBy()` does not sort** (#81). It sets `dSortBy[level]` and redraws;
  `updateSorting` is never reached. The header arrow updates, so it fails
  deceptively. The UI header click works.
- **Filter chips go stale after a re-sort** (#82). Rows stay correct; the label
  names an attribute that no longer orders the view.
- **No sort history is retained.** `dSortBy[L]` holds only the current sort, yet
  ties resolve by the *previous* order (`Array.prototype.sort` is stable), so
  reproducing a visual ordering elsewhere may need the full history.
- **`FilterByRange` compares positions, not values**, so a serialized range is
  only meaningful against the same rows in the same order.

## 7. Rules of thumb

1. **Measure, don't infer.** Reading the source suggested filters are
   re-evaluated on sort; they are not. A ten-line Playwright probe settled in
   minutes what the reading got wrong.
2. **`selected` is state, not a derivation.** If you need it fresh, trigger a
   filter action; a redraw will not recompute it.
3. **Never assume a range filter is a value range.**
4. **Unit tests can pass while the build fails.** Vitest runs `src/` directly;
   `rollup-plugin-ascii` parses it with an ES5-era acorn and rejects modern
   syntax (#80). Always run `npm run build`, and check its exit code rather
   than grepping its output.
