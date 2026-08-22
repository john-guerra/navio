# Extracting the canvas renderers (2026-08-21)

Design for the next phase of issue [#67](https://github.com/john-guerra/navio/issues/67),
written against commit `4dd7236`. Follows
`docs/ai/2026-08-21-navio-geometry-injection-design.md`, which built `geom` and
converted every renderer to take it as a parameter — the change that makes this
one possible.

**How to use this doc:** a snapshot. Re-check line references before acting.

**Status:** implemented. See
`docs/superpowers/plans/2026-08-21-navio-canvas-renderer.md` (Tasks 1-5) for
what landed and where it diverged from this design.

## 1. What this is for, and what it is not

The geometry-injection phase moved `src/navio.js` from 4185 to 4183 lines. That
was the point: it was enabling work. A function that reads `xScale`/`yScales`
through the closure cannot leave the file. A function that takes `geom` can.

This phase collects on that. It moves the seven canvas painters into
`src/render/canvas.js`, which is the first slice of `navio.js` to leave since
the settings panel.

It is **not** a rewrite of how drawing works. Every function moves with its body
intact; what changes is where the bindings it reads come from.

## 2. Why the canvas group and not the SVG group

Measured at `4dd7236`:

| Group | Functions | Lines | Free bindings | Direction |
| --- | --- | --- | --- | --- |
| Canvas | `drawItem`, `drawLevelBorder`, `drawLink`, `drawLinks`, `drawLine`, `drawLevelConnections`, `updateLevel` | 208 | ~17 | reads only |
| SVG overlay | `drawAttribHeaders`, `drawAttributesHolders`, `drawFilterExplanationsHTML`, `drawCounts`, `drawBrushes`, `drawCloseButton` | 510 | ~25 | reads, mutates, re-enters the pipeline |

The SVG group is the bigger prize by line count and the worse extraction. It
calls `updateData`, `applyFiltersAndUpdate`, `applyContainerSize`,
`updateBrushes` and `moveAttrToPos` — it does not render a model, it drives the
widget. Extracting it means passing five callbacks back in, producing a module
harder to read than the closure it left.

**The criterion is the direction of the dependency, not its count.** A boundary
across a read-only surface is a parameter list. A boundary across a control-flow
surface is a callback tangle. The SVG group needs its own design pass about that
control flow first; it is explicitly out of scope here.

## 3. The module

```js
// src/render/canvas.js
export function createCanvasRenderer(ctx) { ... }
```

Returns `{ updateLevel, drawLinks }` — the two entry points `nv.update` actually
calls. `drawItem`, `drawLevelBorder`, `drawLevelConnections`, `drawLink` and
`drawLine` become private to the module; they have no caller outside it.

Verified at `4dd7236`: `drawItem` is called only from `updateLevel:3323`,
`drawLink` only from `drawLinks:2849`, `drawLine` only from
`drawLevelConnections`, `drawLevelBorder` and `drawLevelConnections` only from
`updateLevel`. `updateLevel` is called from `nv.update:3541`, `drawLinks` from
`nv.update:3540`. The public surface is genuinely two functions.

### 3.1 The context

Same mechanism as `geometry.js`, and the same rule from `CLAUDE.md`: **a module
gets getters, not values**, for anything the closure rebinds.

**Must be getters** — each is reassigned during the widget's life:

| binding | where it is rebound |
| --- | --- |
| `context` | `init():979` |
| `data` | `nv.data():3617`, `nv.destroy():4099` |
| `dataIs` | `:3479`, `:3624` |
| `links` | `nv.links():4001`, `destroy:4104` |
| `visibleLinks` | `recomputeVisibleLinks:3308`, `destroy:4105` |
| `selectedFlags` | `:3619`, `destroy:4100` |
| `colScales` | `init():935`, `:3445` |

**Safe as plain values** — never rebound, per the rule's own wording ("about
WHAT the binding is, not which name it has"):

- `nv` — never rebound.
- `idOf`, `getAttrib`, `getAttribName`, `visibleAttribs`, `indexOfRow`, `posAt`,
  `isMissing` — hoisted function declarations.
- `theme`, `divisionsColour` — `const`-destructured from the settings module at
  `:1258-1269`.

`geom` stays a **parameter**, not a ctx entry. Every one of these functions
already takes it; threading it through the ctx instead would be a second,
redundant path to the same object.

### 3.2 Why this ctx is bigger than geometry's, and what that means

Seventeen entries against `geometry.js`'s six. That is worth naming rather than
hiding: nine of the seventeen (`data`, `selectedFlags`, `idOf`, `getAttrib`,
`getAttribName`, `indexOfRow`, `posAt`, `isMissing`, `visibleAttribs`) are all
one idea — *resolve a row or an attribute by index*. They are the natural next
seam, and `CLAUDE.md`'s "Navio never writes to the caller's rows" landmine is
already about exactly this surface.

This design does **not** extract them. That would be inventing a module to serve
a module — YAGNI, and it would double the size of this change. It notes the seam
so the next phase does not have to rediscover it.

## 4. The performance constraint

`drawItem` is called once per representative row, inside `updateLevel`'s loop.
This is the hot path, and it is the same path where issue
[#111](https://github.com/john-guerra/navio/issues/111) measured a ~7.7-8.5%
regression when `geom` turned direct reads into method calls.

Two rules follow, and `CLAUDE.md`'s "measure performance claims; do not reason
about them" governs both.

**Destructure at entry, never in the loop.** `drawItem` already destructures
`geom` at entry; it must do the same with the ctx bindings it reads per
iteration (`context`, `data`, `selectedFlags`, `colScales`). A getter read is a
function call; per-attribute is the wrong frequency for it.

**Fix #111 in this phase, not after it.** Its scoped fix — hoist `pixelRatio()`
once per render in `drawItem` and in `geometry.js`'s `snapToDevice` — touches
the exact function this change moves. Doing them separately means benchmarking
the same hot path twice and leaving a known regression to compound with an
unknown one.

The gate is a real before/after benchmark using the harness Tasks 4 and 5 of the
previous phase already built: 100 `hardUpdate()` calls at 5000 rows, git-stash
for the clean baseline, A/B/A ordering, warmup discarded. **A measured net
regression fails the task**; #111's fix should make the net favourable, but the
number decides, not this sentence.

## 5. What must not change

- **No API change.** `nv.update` keeps its signature; the two entry points are
  called the same way with the same arguments plus nothing.
- **No behaviour change.** Every function body moves intact.
- **`drawLine` keeps taking already-mapped screen points.** It is not a geometry
  consumer — `drawLevelConnections` maps its path through `geom.toXY` before
  calling it. This was checked and confirmed correct in the previous phase's
  final review; do not "fix" it to take `geom`.
- **Do not cache resolved link endpoints.** `CLAUDE.md`'s landmine applies
  directly: `drawLink` resolves `link.source`/`link.target` through `indexOfRow`
  on every call because callers mutate the link array in place. It was tried, it
  regressed, it was reverted, and `test/e2e/61-link-endpoints.spec.js` pins it.
  Moving the function must not become an excuse to revisit this.

## 6. Testing

`geometry.js` made navio's geometry unit-testable for the first time. This does
**less** of that, honestly: canvas painting is verified by what lands on the
canvas, which `CLAUDE.md` is explicit belongs in Playwright, not jsdom.

So the coverage story is:

- **Existing e2e is the regression net.** 293 specs pass at `4dd7236`; they must
  still pass. `106-pixel-grid.spec.js` (the #105 half-pixel fix) and
  `61-link-endpoints.spec.js` are the two that would catch a bad move.
- **One new unit test**, on the module's construction contract only: that
  `createCanvasRenderer` reads `context`/`data`/`dataIs` through getters and
  reflects a reassignment, mirroring `test/unit/geometry.test.js`'s live-read
  tests. This is the part that is genuinely unit-testable and the part the
  getter rule exists for.
- **No new canvas-pixel assertions.** The e2e suite already covers that surface;
  adding jsdom-based ones would be the mistake `CLAUDE.md` warns against.

## 7. Sequencing

1. Build `src/render/canvas.js` with the ctx contract and its unit test; leave
   `navio.js` untouched and the module unused. Proves construction in isolation.
2. Move the five private painters (`drawItem`, `drawLevelBorder`, `drawLink`,
   `drawLine`, `drawLevelConnections`) into it. `navio.js` keeps `updateLevel`
   and `drawLinks` as thin wrappers so the diff stays reviewable.
3. Move `updateLevel` and `drawLinks`; delete the wrappers; wire `nv.update` to
   the module's two entry points.
4. Fix #111 (hoist `pixelRatio()` in `drawItem` and `snapToDevice`) and run the
   mandatory benchmark. Close the issue with the numbers.
5. Update `CLAUDE.md`'s Layout block.

Steps 2 and 3 split deliberately: a single commit moving all seven at once is a
~210-line diff with no intermediate green state, and the previous phase's
experience is that a reviewer catches more in two scoped diffs than one large
one.

## 8. Risks

- **The hot path regresses.** Mitigated by §4's rules and gated by measurement,
  not judgement. This is the risk that decides whether the phase lands.
- **A ctx entry is missed and silently reads `undefined`.** `context` is the
  dangerous one: canvas methods on `undefined` throw immediately, which is the
  good case; a stale `data` reference would not. Mitigated by the getter table
  in §3.1 being exhaustive and by e2e running on every task.
- **`updateLevel`'s wrapper phase leaves a half-moved state.** Bounded: step 2
  and step 3 are consecutive tasks in one plan, each independently green.
