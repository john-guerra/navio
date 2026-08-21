# Navio Geometry Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `geom`, a long-lived geometry object injected into every renderer
and event handler in `src/navio.js` that currently reads `xScale`/`yScales`/
`levelScale`/`height`/`pixelRatio` as closure bindings, so those readers stop
touching raw scale objects directly.

**Architecture:** `createGeometry(ctx)` in a new `src/geometry.js`, built once in
`init()` after the scale assignments it depends on. Its methods read live state
at call time through getters — no per-update snapshot, no staleness. Renderers
and handlers receive `geom` as an argument (or, for callbacks already nested
inside a converted function, inherit it via closure). `xScale`, `yScales`,
`levelScale`, `height` and `pixelRatio` themselves stay put — they are owned and
mutated by `init()`/`updateScales()`/`updateWidthAndHeight()`, which are not
conversion targets.

**Tech Stack:** ES modules, d3 (external per `rollup.config.js`), vitest for pure
logic, Playwright for DOM/canvas/pointer behaviour.

**Spec:** `docs/ai/2026-08-21-navio-geometry-injection-design.md` — read it
first, especially §3 (the interface, before this plan's extensions), §8
(sequencing) and §11–§12 (what two rounds of review found wrong and why).

## Corrections found while writing this plan

Per this repo's own convention (`CLAUDE.md`, `docs/ai/*-design.md` §11/§12
pattern): a plan is where a design's remaining gaps surface, because it is the
first artifact that has to name every real call site. Two were found here,
verified against `src/navio.js` at commit `ca40f41` (unchanged since — verify
with `git diff --stat ca40f41 HEAD -- src/navio.js` before trusting any line
number below).

1. **The spec's twelve methods are insufficient.** Tracing every named target in
   the spec's §8 sequencing against the actual source turned up six more
   primitives, all forward-mapping and all in the same category as the twelve
   already specified — see Task 1's interface table for the call-site evidence
   for each.
2. **Step 7 ("delete the geometry bindings from the `let` chain") cannot fully
   happen.** `init()`, `updateScales()` and `updateWidthAndHeight()` are not
   conversion targets — they are what *configures* `xScale`/`yScales`/
   `levelScale`/`height`/`pixelRatio` in the first place, and they read and
   write those bindings directly regardless of `geom`. Task 7 in this plan
   deletes what can actually be deleted (`x`, `invertScaleCache`) and instead
   *proves* — rather than claims — that no code outside those three functions
   and `geometry.js` reads the remaining five bindings.

Neither correction changes the mechanism, the staleness fixes, or the
performance conclusions the two review rounds validated. Both are additive.

## Global Constraints

- **Behaviour-preserving.** No behaviour change, no API change, no new option.
  `src/params.js` and `docs/ai/API.md` are untouched by this plan.
- **The construction contract (spec §3):** `xScale` and `levelScale` are
  assigned exactly once, inside `init()` (`src/navio.js:925`, `932`), and never
  reassigned — safe to capture as plain values **only if `createGeometry` is
  constructed after that assignment**. `yScales` and `pixelRatio` **are**
  reassigned (`yScales[level] =` in `updateScales`, `yScales = []` in
  `nv.destroy`; `pixelRatio =` in `init()` and `updateWidthAndHeight`) and
  **must** be read through a getter, with no exception — a value capture of
  `yScales` would keep the pre-destroy scale array reachable through `geom`
  after `destroy()`, which is a memory leak specific to a correctly-functioning
  `geom`, not a teardown bug.
- **Naming:** `extentA` / `recordExtent`, never `width` / `height` — CLAUDE.md's
  landmine on hardcoding screen axes in a widget that transposes them in
  vertical orientation.
- **Gate per task:** `npm run check` **and**
  `NAVIO_TEST_PORT=4190 npx playwright test` must both pass before the next
  task begins. `npm run check` does not run e2e.
- **Check exit codes, never grep output.**
  `npm run build > /tmp/x.log 2>&1; echo "EXIT: $?"`
- **`grep` is aliased to `ugrep` in this environment and has silently returned
  wrong counts twice already this project.** Verify any count with `node`
  (an AST parser, not a regex) or cross-check with `fgrep`.
- **Commit each task separately.** Do not batch.
- **Hot-path rule (spec §6):** any renderer called per representative per level
  (`drawItem`, the `drawLinks` loop) must destructure `geom` once at function
  entry, not read `geom.<method>()` per iteration. Measured: per-read costs
  7–10% on the isolated loop; destructured, it is at parity.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/geometry.js` (new) | `createGeometry(ctx)` — the coordinate system. Forward mapping, inverse mapping, and the private `invertScaleCache` this absorbs from `navio.js`. |
| `test/unit/geometry.test.js` (new) | Pure-logic tests: horizontal/vertical transposition, inverse-of-forward round trips. |
| `test/e2e/geometry-injection.spec.js` (new) | The mechanism's distinctive failure modes: a `destroy()`-then-GC-reachability check, and a hit-test still working after a data change. |
| `src/navio.js` (modify) | Constructs `geom` once in `init()`; every renderer/handler in the task list below is rewritten to take/close over it. |
| `CLAUDE.md` (modify, Task 8) | Layout block updated for `geometry.js`. |

---

## Task 1: Build `src/geometry.js` and construct it, unused

**Files:**
- Create: `src/geometry.js`
- Create: `test/unit/geometry.test.js`
- Modify: `src/navio.js` — add the import and one `const geom = createGeometry(ctx)` call in `init()`, after line 935. Nothing else calls it yet.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```js
  export function createGeometry(ctx);
  // ctx: {
  //   nv,
  //   xScale,                      // plain value — assigned once, before construction
  //   levelScale,                  // plain value — assigned once, before construction
  //   get yScales(),                // GETTER — reassigned per level and at destroy
  //   get height(),                 // GETTER — reassigned by nv.height and settings restore
  //   get pixelRatio(),             // GETTER — reassigned in init() and updateWidthAndHeight
  // }
  // returns 18 methods, listed below.
  ```

### The complete interface, with the call-site evidence for the six additions beyond the spec's twelve

| Method | Formula | Why it exists (real call site) |
| --- | --- | --- |
| `isVertical()` | `ctx.nv.orientation === "vertical"` | spec §3, unchanged |
| `toXY(a, r)` | `isVertical() ? {x:r,y:a} : {x:a,y:r}` | spec §3, unchanged |
| `toWH(a, r)` | `isVertical() ? {width:r,height:a} : {width:a,height:r}` | spec §3, unchanged |
| `cellA(attribName, level)` | `ctx.levelScale(level) + ctx.xScale(attribName)` | spec §3 (was `x()`) |
| `cellR(rowId, level)` | `ctx.yScales[level](rowId)` | spec §3 |
| `bandwidthA()` | `ctx.xScale.bandwidth()` | **new.** `drawItem` (`src/navio.js:1409`), `showDropIndicator` (`2715`), `updateBrushes` (`1657`), `measureHeaderBand` (`2242`,`2323`), `drawAttribHeaders` (`2438`,`2439`) |
| `bandwidthR(level)` | `ctx.yScales[level].bandwidth()` | spec §3 |
| `stepA()` | `ctx.xScale.step()` | **new.** `drawAttributesHolders` (`2818`,`2819`) |
| `levelStartA(level)` | `ctx.levelScale(level)` | **new.** `drawLevelBorder` (`2895`), `drawLevelConnections` (`2896`,`2899`), `drawFilterExplanationsHTML`'s `levelRight` (`2090`), `drawCounts` (`2050`) |
| `levelExtentA()` | `ctx.xScale.range()[1]` | **new.** Same call sites as `levelStartA` |
| `recordAxisStart()` | `ctx.nv.y0` | spec §3 (resolved value; `applyHeaderBand` writes `nv.y0` directly, unaffected by this plan) |
| `extentA()` | `ctx.levelScale.range()[1] + ctx.nv.margin + ctx.nv.x0` | spec §3 (was "width") |
| `recordExtent()` | `ctx.height` | spec §3 (was "height") — this is the **data** extent only, distinct from `recordAxisTotal()` in `updateWidthAndHeight`/`applyContainerSize`, which is container sizing and stays unconverted |
| `pixelRatio()` | `ctx.pixelRatio` | spec §3 |
| `snapToDevice(coord, deviceWidth)` | `Math.round(coord * pixelRatio()) + (deviceWidth % 2 ? 0.5 : 0)) / pixelRatio()` | spec §3 |
| `attribAtA(pos, level)` | inverse of `cellA`; returns the **attribute name**, not the attribute object | spec §3 (round 2 fix). `columnAtPointer` (`2685`), `dropTargetFor` (`2691`), `showTooltip` (`1932`), `onSelectByValueFromCoords` (`1865`) |
| `rowAtR(pos, level)` | inverse of `cellR`; returns the **row id**, not the row index | spec §3 (round 2 fix). `showTooltip` (`1926`), `onSelectByRange` (`1772`,`1774`), `onSelectByValueFromCoords` (`1860`) |
| `levelAtA(pos)` | inverse of `levelStartA`; which level a screen position along A falls in | **new.** The inline sort-click handler registered in `init()` at `src/navio.js:801-834`: `invertOrdinalScale(levelScale, alongA)` at line `821` |
| `invalidateInvertCache()` | resets the module's own inversion memoization | **new, and a simplification.** `invertScaleCache` (`src/navio.js:86`) and `invalidateInvertCache` (`1015-1017`) move into `geometry.js` entirely — they exist only to serve `attribAtA`/`rowAtR`/`levelAtA`, so `geometry.js` owns the cache privately instead of it being a sixth shared `let` binding. Called today from `updateScales` at `3197`; that call site becomes `geom.invalidateInvertCache()`. |

`attribAtA`/`rowAtR`/`levelAtA` do **not** look up `dAttribs`/`dData` — they
return the raw domain value (attribute name / row id), exactly like
`invertOrdinalScale` does today. Callers that need the attribute *object* or
the row *index* do that lookup themselves, outside `geom` — this keeps instance
state (`dAttribs`, `dData`) out of geometry, per spec §3.

- [ ] **Step 1: Write the failing unit test**

Create `test/unit/geometry.test.js`:

```js
import { describe, it, expect } from "vitest";
import { createGeometry } from "../../src/geometry.js";

// A minimal fake scale: enough for cellA/cellR/bandwidthA/stepA/levelStartA/
// levelExtentA/attribAtA/rowAtR/levelAtA to exercise real math, not stubs.
function fakeXScale(domain, range) {
  const step = (range[1] - range[0]) / domain.length;
  const fn = (name) => range[0] + domain.indexOf(name) * step;
  fn.bandwidth = () => step * 0.9;
  fn.step = () => step;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}
function fakeLevelScale(domain, range) {
  const step = domain.length ? (range[1] - range[0]) / domain.length : 0;
  const fn = (level) => range[0] + level * step;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}
function fakeYScales(domain, range) {
  const step = domain.length ? (range[1] - range[0]) / domain.length : 0;
  const fn = (id) => range[0] + domain.indexOf(id) * step;
  fn.bandwidth = () => step * 0.9;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}

function buildCtx(overrides = {}) {
  const xScale = fakeXScale(["a", "b", "c"], [0, 300]);
  const levelScale = fakeLevelScale([0, 1], [0, 640]);
  const yScales = [fakeYScales(["r1", "r2", "r3", "r4"], [100, 500])];
  return {
    nv: { orientation: "horizontal", y0: 100, margin: 10, x0: 5, ...overrides.nv },
    xScale,
    levelScale,
    get yScales() {
      return overrides.yScales || yScales;
    },
    get height() {
      return overrides.height !== undefined ? overrides.height : 400;
    },
    get pixelRatio() {
      return overrides.pixelRatio !== undefined ? overrides.pixelRatio : 1;
    },
  };
}

describe("orientation transposition", () => {
  it("horizontal: attribute is x, record is y", () => {
    const geom = createGeometry(buildCtx());
    expect(geom.toXY(10, 20)).toEqual({ x: 10, y: 20 });
    expect(geom.toWH(10, 20)).toEqual({ width: 10, height: 20 });
  });

  it("vertical: attribute is y, record is x", () => {
    const geom = createGeometry(buildCtx({ nv: { orientation: "vertical" } }));
    expect(geom.toXY(10, 20)).toEqual({ x: 20, y: 10 });
    expect(geom.toWH(10, 20)).toEqual({ width: 20, height: 10 });
  });
});

describe("forward and inverse round-trip", () => {
  it("attribAtA inverts cellA back to the attribute name", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.cellA("b", 1);
    expect(geom.attribAtA(pos, 1)).toBe("b");
  });

  it("rowAtR inverts cellR back to the row id", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.cellR("r3", 0);
    expect(geom.rowAtR(pos, 0)).toBe("r3");
  });

  it("levelAtA inverts levelStartA back to the level index", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.levelStartA(1);
    expect(geom.levelAtA(pos)).toBe(1);
  });
});

describe("live reads", () => {
  it("recordExtent reads the CURRENT height, not one captured at construction", () => {
    let h = 400;
    const ctx = buildCtx();
    Object.defineProperty(ctx, "height", { get: () => h });
    const geom = createGeometry(ctx);
    expect(geom.recordExtent()).toBe(400);
    h = 900;
    expect(geom.recordExtent()).toBe(900);
  });

  it("cellR reads the CURRENT yScales array, not one captured at construction", () => {
    let scales = [fakeYScales(["r1"], [0, 100])];
    const ctx = buildCtx();
    Object.defineProperty(ctx, "yScales", { get: () => scales });
    const geom = createGeometry(ctx);
    const before = geom.cellR("r1", 0);
    scales = [fakeYScales(["r1"], [0, 1000])];
    const after = geom.cellR("r1", 0);
    expect(after).not.toBe(before);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run test/unit/geometry.test.js
```

Expected: FAIL — `Failed to resolve import "../../src/geometry.js"`.

- [ ] **Step 3: Create `src/geometry.js`**

```js
/**
 * navio's coordinate system: the one place that knows how an (attribute,
 * record) pair becomes a position on screen, and the reverse.
 *
 * Built ONCE, in init(), after xScale/levelScale/x are assigned
 * (src/navio.js:925-935) - x itself is superseded by cellA and is deleted
 * once every caller is converted (see the plan's Task 7).
 *
 * `yScales`, `height` and `pixelRatio` are reassigned during the widget's
 * life - yScales per update, all three at destroy or settings-restore - so
 * every method that touches them reads through ctx's GETTERS at call time.
 * A method that captured one of these as a plain value would go stale, and
 * for `yScales` specifically it would keep the pre-destroy scale array
 * reachable through `geom` forever - a memory leak in otherwise-correct code.
 * `xScale` and `levelScale` are the opposite case: assigned exactly once and
 * never reassigned, so capturing them as plain values is safe PROVIDED this
 * factory is constructed after that assignment - never earlier.
 *
 * See docs/ai/2026-08-21-navio-geometry-injection-design.md and
 * docs/superpowers/plans/2026-08-21-navio-geometry-injection.md.
 *
 * @param {object} ctx - { nv, xScale, levelScale, get yScales(), get height(),
 *   get pixelRatio() }
 */
export function createGeometry(ctx) {
  // Owned privately by this module. Previously the shared `invertScaleCache`
  // binding in navio.js; nothing outside attribAtA/rowAtR/levelAtA needs it.
  let invertScaleCache = new WeakMap();

  function invalidateInvertCache() {
    invertScaleCache = new WeakMap();
  }

  // yScales[level] is replaced wholesale on every update, so keying the cache
  // on the scale object already invalidates those entries for free. xScale
  // and levelScale are mutated in place, though, so a stale inversion has to
  // be dropped explicitly by the caller of invalidateInvertCache.
  function invert(scale, pos) {
    let qScale = invertScaleCache.get(scale);
    if (!qScale) {
      qScale = d3.scaleQuantize().domain(scale.range()).range(scale.domain());
      invertScaleCache.set(scale, qScale);
    }
    return qScale(pos);
  }

  function isVertical() {
    return ctx.nv.orientation === "vertical";
  }

  function toXY(a, r) {
    return isVertical() ? { x: r, y: a } : { x: a, y: r };
  }

  function toWH(a, r) {
    return isVertical() ? { width: r, height: a } : { width: a, height: r };
  }

  function cellA(attribName, level) {
    return ctx.levelScale(level) + ctx.xScale(attribName);
  }

  function cellR(rowId, level) {
    return ctx.yScales[level](rowId);
  }

  function bandwidthA() {
    return ctx.xScale.bandwidth();
  }

  function bandwidthR(level) {
    return ctx.yScales[level].bandwidth();
  }

  function stepA() {
    return ctx.xScale.step();
  }

  function levelStartA(level) {
    return ctx.levelScale(level);
  }

  function levelExtentA() {
    return ctx.xScale.range()[1];
  }

  function recordAxisStart() {
    return ctx.nv.y0;
  }

  function extentA() {
    return ctx.levelScale.range()[1] + ctx.nv.margin + ctx.nv.x0;
  }

  function recordExtent() {
    return ctx.height;
  }

  function pixelRatio() {
    return ctx.pixelRatio;
  }

  function snapToDevice(coord, deviceWidth) {
    const dev = Math.round(coord * pixelRatio()) + (deviceWidth % 2 ? 0.5 : 0);
    return dev / pixelRatio();
  }

  function attribAtA(pos, level) {
    return invert(ctx.xScale, pos - ctx.levelScale(level));
  }

  function rowAtR(pos, level) {
    return invert(ctx.yScales[level], pos);
  }

  function levelAtA(pos) {
    return invert(ctx.levelScale, pos);
  }

  return {
    isVertical,
    toXY,
    toWH,
    cellA,
    cellR,
    bandwidthA,
    bandwidthR,
    stepA,
    levelStartA,
    levelExtentA,
    recordAxisStart,
    extentA,
    recordExtent,
    pixelRatio,
    snapToDevice,
    attribAtA,
    rowAtR,
    levelAtA,
    invalidateInvertCache,
  };
}
```

Add the d3 import at the top: `import * as d3 from "d3";` (needed for
`d3.scaleQuantize()` inside `invert`).

- [ ] **Step 4: Run the unit test and confirm it passes**

```bash
npx vitest run test/unit/geometry.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Construct `geom` in `init()`, unused**

**`geom` must be declared in the top-level `let` chain, not with `const`
inside `init()`.** `init()` spans `src/navio.js:677-976` and is one function
among many top-level siblings in `navio()`'s closure — `drawLevelBorder`
(`1442`), `updateLevel` (`3322`), `showTooltip`, and every other function this
plan threads `geom` through are declared *outside* `init()`, at the same
nesting level as `init()` itself, not inside it. A `const` declared inside
`init()`'s body is scoped to `init()` alone; every one of those sibling
functions — and every place that needs to *pass* `geom` into them — would hit
`ReferenceError: geom is not defined`. This is exactly the same category of
mistake the "getters not values" landmine warns about, one level removed: not
a stale binding, but a binding that was never reachable in the first place.

The fix matches how `xScale`, `levelScale` and `canvas` already work: declared
bare in the chain at the top of `navio()` (`src/navio.js:71-165`, e.g. `xScale,`
with no initializer at line 87), then *assigned* — not re-declared — inside
`init()`. `geom` is assigned exactly once, the same category as `xScale`
itself, so this is safe.

In the `let` chain (`src/navio.js:71-165`), add `geom,` as a new bare entry,
anywhere in the list (e.g. beside `xScale,`).

In `src/navio.js`, add the import beside the others:

```js
import { createGeometry } from "./geometry.js";
```

After line 935 (`x = function (val, level) { return levelScale(level) + xScale(val); };`),
add:

```js
    geom = createGeometry({
      nv,
      xScale,
      levelScale,
      get yScales() {
        return yScales;
      },
      get height() {
        return height;
      },
      get pixelRatio() {
        return pixelRatio;
      },
    });
```

(Assignment, `geom = createGeometry(...)` — no `const`, no `let`.)

Do not remove `x`, `invertScaleCache`, or `invalidateInvertCache` yet — every
current caller still uses them. This step only proves `geom` builds without
error.

- [ ] **Step 6: Full gate**

```bash
npm run check > /tmp/check1.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e1.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`. `geom` is constructed and immediately unused — this
must not change any behaviour or fail lint (an unused `const` is not a
`no-unused-vars` violation the way an unused import is, but confirm).

- [ ] **Step 7: Commit**

```bash
git add src/geometry.js test/unit/geometry.test.js src/navio.js
git commit -m "Build geom, navio's injected coordinate system, unused"
```

---

## Task 2: Convert `drawLevelBorder` — the first end-to-end proof

**Files:**
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `geom` from Task 1.
- Produces: the call-site pattern every later task repeats — `fn(geom, ...)`.

- [ ] **Step 1: Convert the function**

Before (`src/navio.js`):

```js
  function drawLevelBorder(i) {
    context.save();
    context.beginPath();
    const origin = toXY(levelScale(i), yScales[i].range()[0] - 1),
      size = toWH(
        xScale.range()[1] + 1,
        yScales[i].range()[1] + 2 - yScales[i].range()[0]
      );
    context.rect(origin.x, origin.y, size.width, size.height);
    context.strokeStyle = theme().border;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }
```

After:

```js
  function drawLevelBorder(geom, i) {
    context.save();
    context.beginPath();
    const origin = geom.toXY(geom.levelStartA(i), geom.recordAxisStart() - 1),
      size = geom.toWH(geom.levelExtentA() + 1, geom.recordExtent() + 2);
    context.rect(origin.x, origin.y, size.width, size.height);
    context.strokeStyle = theme().border;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }
```

(`yScales[i].range()[0]` is always `nv.y0` and `yScales[i].range()[1]` is
always `nv.y0 + height` — every level's y-scale shares the same range,
assigned in `updateScales`. So `origin`'s R component
(`yScales[i].range()[0] - 1`) is `geom.recordAxisStart() - 1`, and `size`'s R
component (`yScales[i].range()[1] + 2 - yScales[i].range()[0]`) reduces to
`geom.recordExtent() + 2`.)

- [ ] **Step 2: Update the one caller**

`drawLevelBorder` is called from `updateLevel` (`src/navio.js`, inside the
function converted in Task 4). For this task, change only the call to pass
`geom` — `updateLevel` itself is not otherwise touched yet:

```js
  function updateLevel(levelData, i) {
    drawLevelBorder(geom, i);
    for (let rep of levelData.representatives) {
      drawItem(rep, i);
    }

    drawLevelConnections(i);
  }
```

`geom` is now a bare top-level binding in `navio()`'s closure (Task 1 Step 5 —
declared in the chain, assigned once in `init()`), so `updateLevel` reads it
via ordinary closure, exactly as it already reads `xScale`/`yScales` today.
Only `drawLevelBorder`'s own signature changes in this task — `updateLevel`'s
body is touched (one call site), but its own signature is not, until Task 4.

- [ ] **Step 3: Full gate**

```bash
npm run check > /tmp/check2.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e2.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`. Every e2e spec that renders anything exercises
`drawLevelBorder` — this is the broadest possible smoke test for the pattern.

- [ ] **Step 4: Commit**

```bash
git add src/navio.js
git commit -m "Convert drawLevelBorder to take geom"
```

---

## Task 3: Convert the handlers

The spec's own justification for a long-lived `geom` rests on this task —
these are the ~19% of sites that run on a pointer event rather than during an
update.

**Files:**
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `geom` (Task 1, now a bare top-level binding — see Task 1 Step 5's
  correction), the `drawLevelBorder(geom, i)` pattern (Task 2).
- Produces: `columnAtPointer(geom, event, level)`, `dropTargetFor(geom, event, d)`,
  `showDropIndicator(geom, event, d)`, `showTooltip(geom, xOnWidget, yOnWidget, clientX, clientY, level)`,
  `restoreBrushes(geom)`, `updateBrushes(geom, d, i)`, `onMouseOver(geom, event, overData)`,
  `draggedHeaderTransform(geom, event, d)`, `attribDragstarted(geom, event, d)`,
  `attribDragged(geom, event, d)`, `attribDragended(geom, event, d)`.
  `nv.setFilters`'s own signature is unchanged (public API); only its body's
  call to `restoreBrushes` gains the `geom` argument.

Every function this task converts has **more than one caller** in at least
one case (`showTooltip`, `restoreBrushes`, `dropTargetFor`) — the steps below
were built by counting every real call site with `node`, not by inspecting
each function's own definition in isolation. Confirm the counts have not
drifted since this plan was written (`ca40f41`) before trusting them:

```bash
git diff --stat ca40f41 HEAD -- src/navio.js   # empty = safe to trust line numbers
node -e '
const fs = require("fs");
const s = fs.readFileSync("src/navio.js", "utf8");
for (const n of ["columnAtPointer","dropTargetFor","showDropIndicator","showTooltip","restoreBrushes","updateBrushes","onMouseOver","attribDragstarted","attribDragged","attribDragended","draggedHeaderTransform"]) {
  const m = s.match(new RegExp("(^|[^.\\w$])" + n + "\\s*\\(", "g")) || [];
  console.log(n.padEnd(20) + m.length + " sites (incl. its own def line)");
}
'
```

- [ ] **Step 1: `columnAtPointer`, `dropTargetFor`**

Before:

```js
  function columnAtPointer(event, level) {
    const p = d3.pointer(event, svg.node());
    const alongA = isVertical() ? p[1] : p[0];
    return dAttribs.get(invertOrdinalScale(xScale, alongA - levelScale(level)));
  }

  function dropTargetFor(event, d) {
    const name = invertOrdinalScale(
      xScale,
      dragAlongA(event) + nv.attribFontSize / 2 - levelScale(d.level)
    );
    return dAttribs.get(name);
  }
```

After:

```js
  function columnAtPointer(geom, event, level) {
    const p = d3.pointer(event, svg.node());
    const alongA = geom.isVertical() ? p[1] : p[0];
    return dAttribs.get(geom.attribAtA(alongA, level));
  }

  function dropTargetFor(geom, event, d) {
    const name = geom.attribAtA(
      dragAlongA(event) + nv.attribFontSize / 2,
      d.level
    );
    return dAttribs.get(name);
  }
```

`attribAtA(pos, level)` subtracts `levelScale(level)` internally (Task 1), so
the caller passes the un-adjusted screen position.

- [ ] **Step 2: `showDropIndicator`**

Before:

```js
  function showDropIndicator(event, d) {
    const target = dropTargetFor(event, d);
    const line = svg.select("._nv_drop_indicator");
    if (target === undefined || target === d.attrib) {
      line.style("display", "none");
      return;
    }
    const from = attribsOrdered.indexOf(d.attrib),
      to = attribsOrdered.indexOf(target);
    const a =
      x(getAttribName(target), d.level) + (to > from ? xScale.bandwidth() : 0);
    const p0 = toXY(a, yScales[d.level].range()[0]),
      p1 = toXY(a, yScales[d.level].range()[1]);
    line
      .style("display", null)
      .attr("x1", p0.x)
      .attr("y1", p0.y)
      .attr("x2", p1.x)
      .attr("y2", p1.y);
  }
```

After:

```js
  function showDropIndicator(geom, event, d) {
    const target = dropTargetFor(geom, event, d);
    const line = svg.select("._nv_drop_indicator");
    if (target === undefined || target === d.attrib) {
      line.style("display", "none");
      return;
    }
    const from = attribsOrdered.indexOf(d.attrib),
      to = attribsOrdered.indexOf(target);
    const a =
      geom.cellA(getAttribName(target), d.level) +
      (to > from ? geom.bandwidthA() : 0);
    const p0 = geom.toXY(a, geom.recordAxisStart()),
      p1 = geom.toXY(a, geom.recordAxisStart() + geom.recordExtent());
    line
      .style("display", null)
      .attr("x1", p0.x)
      .attr("y1", p0.y)
      .attr("x2", p1.x)
      .attr("y2", p1.y);
  }
```

Find every caller of `showDropIndicator` and `columnAtPointer` (used by
`attribDragstarted`/`attribDragged`/`attribDragended`) and thread `geom`
through — those three functions are nested lexically alongside these and can
take `geom` as their own first parameter, since they are called from d3 drag
callbacks that this task also updates to pass it.

- [ ] **Step 3: `showTooltip`**

Before:

```js
  function showTooltip(xOnWidget, yOnWidget, clientX, clientY, level) {
    const onA = isVertical() ? yOnWidget : xOnWidget,
      onR = isVertical() ? xOnWidget : yOnWidget;

    let itemId;
    try {
      itemId = invertOrdinalScale(yScales[level], onR);
    } catch (e) {
      nv.DEBUG && console.log("Navio.showTooltip Error inverting scale", e);
      return;
    }

    let itemAttr = invertOrdinalScale(xScale, onA - levelScale(level));
    const rowIdx = dData.get(itemId);
    ...
```

After:

```js
  function showTooltip(geom, xOnWidget, yOnWidget, clientX, clientY, level) {
    const onA = geom.isVertical() ? yOnWidget : xOnWidget,
      onR = geom.isVertical() ? xOnWidget : yOnWidget;

    let itemId;
    try {
      itemId = geom.rowAtR(onR, level);
    } catch (e) {
      nv.DEBUG && console.log("Navio.showTooltip Error inverting scale", e);
      return;
    }

    let itemAttr = geom.attribAtA(onA, level);
    const rowIdx = dData.get(itemId);
    ...
```

(The rest of the function body is unchanged — only the two inversions move.)

- [ ] **Step 4: `restoreBrushes`**

Before:

```js
  function restoreBrushes() {
    filtersByLevel.forEach((levelFilters, level) => {
      if (!levelFilters || !dBrushes[level] || !yScales[level]) return;
      ...
      const y0 = yScales[level](idOf(firstIndex));
      const y1 = yScales[level](idOf(lastIndex));
      if (y0 === undefined || y1 === undefined) return;

      const band = yScales[level].bandwidth();
      g.call(dBrushes[level].move, [Math.min(y0, y1), Math.max(y0, y1) + band]);
    });
  }
```

After:

```js
  function restoreBrushes(geom) {
    filtersByLevel.forEach((levelFilters, level) => {
      if (!levelFilters || !dBrushes[level] || !yScales[level]) return;
      ...
      const y0 = geom.cellR(idOf(firstIndex), level);
      const y1 = geom.cellR(idOf(lastIndex), level);
      if (y0 === undefined || y1 === undefined) return;

      const band = geom.bandwidthR(level);
      g.call(dBrushes[level].move, [Math.min(y0, y1), Math.max(y0, y1) + band]);
    });
  }
```

`restoreBrushes` still guards on `!yScales[level]` directly — that stays: it
is checking whether the level *exists at all*, not computing a coordinate, so
it is instance-state-shaped logic, not geometry.

Its one caller is `nv.hardUpdate` (`src/navio.js`, `if (shouldDrawBrushes) restoreBrushes();`)
— update it to `restoreBrushes(geom)`.

- [ ] **Step 5: `updateBrushes` and its nested handlers**

Before (excerpt — the geometry-touching lines):

```js
  function updateBrushes(d, level) {
    const domain = xScale.domain(),
      aLo = domain.length ? x(domain[0], level) : 0,
      aHi = domain.length
        ? x(domain[domain.length - 1], level) + xScale.bandwidth() * 1.1
        : 0,
      rLo = yScales[level].range()[0],
      rHi = yScales[level].range()[1],
      c0 = toXY(aLo, rLo),
      c1 = toXY(aHi, rHi);
    dBrushes[level] = (isVertical() ? d3.brushX() : d3.brushY())
      ...
    brushG.selectAll("rect").attr(isVertical() ? "height" : "width", aHi);
    ...

    function brushed(event) {
      ...
      showTooltip(xOnWidget, yOnWidget, clientX, clientY, level);
    }

    function onSelectByRange(event) {
      ...
      let firstIndex = dData.get(invertOrdinalScale(yScales[level], brushed[0])),
        lastIndex = dData.get(invertOrdinalScale(yScales[level], brushed[1]));
      ...
    }

    function onSelectByValueFromCoords(event, clientX, clientY) {
      ...
      const itemId = invertOrdinalScale(yScales[level], onR);
      ...
      let itemAttr = invertOrdinalScale(xScale, onA - levelScale(level));
      ...
```

After (the same excerpt):

```js
  function updateBrushes(geom, d, level) {
    // Domain emptiness (#hiding-every-column) is attribute-list state, not
    // geometry - read it from visibleAttribs(), not the raw scale.
    const visible = visibleAttribs(),
      aLo = visible.length ? geom.cellA(getAttribName(visible[0]), level) : 0,
      aHi = visible.length
        ? geom.cellA(getAttribName(visible[visible.length - 1]), level) +
          geom.bandwidthA() * 1.1
        : 0,
      rLo = geom.recordAxisStart(),
      rHi = geom.recordAxisStart() + geom.recordExtent(),
      c0 = geom.toXY(aLo, rLo),
      c1 = geom.toXY(aHi, rHi);
    dBrushes[level] = (geom.isVertical() ? d3.brushX() : d3.brushY())
      ...
    brushG.selectAll("rect").attr(geom.isVertical() ? "height" : "width", aHi);
    ...

    function brushed(event) {
      ...
      showTooltip(geom, xOnWidget, yOnWidget, clientX, clientY, level);
    }

    function onSelectByRange(event) {
      ...
      let firstIndex = dData.get(geom.rowAtR(brushed[0], level)),
        lastIndex = dData.get(geom.rowAtR(brushed[1], level));
      ...
    }

    function onSelectByValueFromCoords(event, clientX, clientY) {
      ...
      const itemId = geom.rowAtR(onR, level);
      ...
      let itemAttr = geom.attribAtA(onA, level);
      ...
```

`brushed`, `onSelectByRange`, `onSelectByValue`, `onSelectByValueFromCoords`
are declared **inside** `updateBrushes` — adding `geom` as `updateBrushes`'s
own parameter makes it available to all four via ordinary closure, with no
further signature changes needed on any of them.

(`xScale.domain()[xScale.domain().length - 1]` reads: this was semantically
`getAttribName(visibleAttribs()[visibleAttribs().length - 1])` all along,
since `updateScales` sets `xScale.domain(laidOut.map((d) => getAttribName(d)))`
with `laidOut = visibleAttribs()`. The rewrite above is behaviour-preserving,
not an approximation.)

- [ ] **Step 6: `drawBrushes` — the caller that threads `geom` downward**

Before:

```js
    if (recomputeBrushes) {
      levelOverlayEnter.merge(levelOverlay).each(updateBrushes);
    } else {
      levelOverlayEnter.each(updateBrushes);
    }
```

After — `updateBrushes` reads `d3.select(this)` internally
(`src/navio.js:1671-1672`), so the wrapper must preserve `this`:

```js
    if (recomputeBrushes) {
      levelOverlayEnter
        .merge(levelOverlay)
        .each(function (d, i) {
          updateBrushes.call(this, geom, d, i);
        });
    } else {
      levelOverlayEnter.each(function (d, i) {
        updateBrushes.call(this, geom, d, i);
      });
    }
```

`drawBrushes` itself gains no new parameter — `geom` is visible to it via the
enclosing closure, same as `updateLevel` in Task 2.

- [ ] **Step 7: the inline sort-click handler in `init()`**

Before (`src/navio.js:801-834`, excerpt):

```js
      .on("click", function (event) {
        if (!dataIs.length || !yScales.length) return;
        const p = d3.pointer(event, svg.node());
        const alongA = isVertical() ? p[1] : p[0],
          alongR = isVertical() ? p[0] : p[1];

        const level = invertOrdinalScale(levelScale, alongA);
        if (level === undefined || !yScales[level]) return;
        if (alongR >= yScales[level].range()[0]) return;

        const attrib = columnAtPointer(event, level);
        ...
```

After:

```js
      .on("click", function (event) {
        if (!dataIs.length || !yScales.length) return;
        const p = d3.pointer(event, svg.node());
        const alongA = geom.isVertical() ? p[1] : p[0],
          alongR = geom.isVertical() ? p[0] : p[1];

        const level = geom.levelAtA(alongA);
        if (level === undefined || !yScales[level]) return;
        if (alongR >= geom.recordAxisStart()) return;

        const attrib = columnAtPointer(geom, event, level);
        ...
```

This callback is defined textually *before* the line that assigns `geom`
(Task 1 Step 5, after line 935) — that does not matter. `geom` is a top-level
binding in the same closure (like `xScale`), so any reference to it, from any
function in the file, resolves to whatever `geom` currently holds at the
moment that code actually *runs*. This callback only runs on a real user
click, long after `init()` has returned and `geom` is fully assigned. Only the
*assignment itself* has an ordering requirement (it must happen after line
935, since `xScale`/`levelScale` must already hold their final values) —
*reading* `geom` from elsewhere never does.

- [ ] **Step 8: `onMouseOver` — the second caller of `showTooltip`**

`showTooltip` has two callers, not one: `brushed` (Step 5, nested inside
`updateBrushes`) and `onMouseOver` — a **top-level** function (same nesting
level as `drawLevelBorder`, not nested inside anything), registered as
`.on("mousemove", onMouseOver)` inside `updateBrushes`'s `brushG` setup
(`src/navio.js:1697`). Missing this caller would leave `showTooltip`'s
signature changed (Step 3) while one of its two call sites still passed the
old argument list.

Before:

```js
  function onMouseOver(event, overData) {
    const xOnWidget = d3.pointer(event)[0],
      yOnWidget = d3.pointer(event)[1],
      clientX = event.clientX,
      clientY = event.clientY;
    ...
    if (!overData.data || overData.data.length === 0) {
      ...
      return;
    }
    showTooltip(xOnWidget, yOnWidget, clientX, clientY, overData.level);
  }
```

After:

```js
  function onMouseOver(geom, event, overData) {
    const xOnWidget = d3.pointer(event)[0],
      yOnWidget = d3.pointer(event)[1],
      clientX = event.clientX,
      clientY = event.clientY;
    ...
    if (!overData.data || overData.data.length === 0) {
      ...
      return;
    }
    showTooltip(geom, xOnWidget, yOnWidget, clientX, clientY, overData.level);
  }
```

`onMouseOver` does not read `this`, so its registration site (inside
`updateBrushes`, Step 5/6's `brushG` chain) needs no `.call(this, ...)`
preservation — a plain arrow function suffices:

```js
    brushG
      .call(dBrushes[level])
      .on("mousemove", (event, d) => onMouseOver(geom, event, d))
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut);
```

(`onSelectByValue` and `onMouseOut` are unaffected — the former is nested
inside `updateBrushes` and already has `geom` via closure per Step 5, the
latter touches no geometry.)

- [ ] **Step 9: `restoreBrushes`'s second caller, in the public `nv.setFilters`**

`restoreBrushes` has two callers: `nv.hardUpdate` (Step 4) and `nv.setFilters`
(`src/navio.js`, near line 3753 — the reactive-widget `setFilters` from #60).
`nv.setFilters(value)` is **public API and its own signature must not
change** (Global Constraints), but its body is a top-level function in the
same closure as `geom` and can read it directly:

```js
    // The brush is how a range filter is expressed on screen; put it back so a
    // synced widget can be dragged, not just read.
    restoreBrushes(geom);
```

- [ ] **Step 10: the header-drag-to-reorder family**

`dropTargetFor` (Step 1) has a **second** caller besides `showDropIndicator`
(Step 2): `attribDragended`. That function, `attribDragstarted`,
`attribDragged` and `draggedHeaderTransform` are four more top-level
functions with geometry, all reached only through one `d3.drag()` registered
inside `drawAttribHeaders` (a Task 6 target) at `src/navio.js:2387-2389`.
They are converted here, in Task 3, because they are pointer-driven handlers
like everything else in this task — but the one-line change to their
*registration* site necessarily touches `drawAttribHeaders`, ahead of Task 6.
**Task 6 must not re-touch the three `.on(...)` lines below** — only the rest
of `drawAttribHeaders`'s geometry (its label-positioning math) remains for
that task.

`draggedHeaderTransform`:

```js
  // before
  function draggedHeaderTransform(event, d) {
    const p = toXY(
      dragAlongA(event) + nv.attribFontSize / 2,
      yScales[d.level].range()[0]
    );
    return `translate(${p.x}, ${p.y})`;
  }

  // after
  function draggedHeaderTransform(geom, event, d) {
    const p = geom.toXY(
      dragAlongA(event) + nv.attribFontSize / 2,
      geom.recordAxisStart()
    );
    return `translate(${p.x}, ${p.y})`;
  }
```

`attribDragstarted`, `attribDragged`:

```js
  // before
  function attribDragstarted(event, d) {
    ...
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(event, dd)
    );
  }
  function attribDragged(event, d) {
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(event, dd)
    );
    showDropIndicator(event, d);
  }

  // after
  function attribDragstarted(geom, event, d) {
    ...
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(geom, event, dd)
    );
  }
  function attribDragged(geom, event, d) {
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(geom, event, dd)
    );
    showDropIndicator(geom, event, d);
  }
```

`attribDragended` (its geometry-touching lines only):

```js
  // before
    const attrDraggedInto = dropTargetFor(event, d);
    if (attrDraggedInto === undefined || attrDraggedInto === d.attrib) return;

    let pos;
    d3.select(this.parentNode).attr("transform", function (dd) {
      const p = toXY(x(dd.name, dd.level), yScales[dd.level].range()[0]);
      return `translate(${p.x}, ${p.y})`;
    });

  // after
  function attribDragended(geom, event, d) {
    ...
    const attrDraggedInto = dropTargetFor(geom, event, d);
    if (attrDraggedInto === undefined || attrDraggedInto === d.attrib) return;

    let pos;
    d3.select(this.parentNode).attr("transform", function (dd) {
      const p = geom.toXY(geom.cellA(dd.name, dd.level), geom.recordAxisStart());
      return `translate(${p.x}, ${p.y})`;
    });
```

The registration, inside `drawAttribHeaders` (`src/navio.js:2387-2389`) — all
three preserve `this` the same way the `updateBrushes`/`.each()` wrapper does
(Step 6), since `attribDragstarted`/`attribDragged`/`attribDragended` all use
`d3.select(this.parentNode)`:

```js
  // before
            .on("start", attribDragstarted)
            .on("drag", attribDragged)
            .on("end", attribDragended)

  // after
            .on("start", function (event, d) {
              attribDragstarted.call(this, geom, event, d);
            })
            .on("drag", function (event, d) {
              attribDragged.call(this, geom, event, d);
            })
            .on("end", function (event, d) {
              attribDragended.call(this, geom, event, d);
            })
```

- [ ] **Step 11: Full gate**

```bash
npm run check > /tmp/check3.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e3.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`. Pay particular attention to specs exercising sort
(`105-sort-by-name.spec.js`), brushing, drag-to-reorder, and tooltips —
`tooltip-placement.spec.js`, `89-settings-panel.spec.js`'s drag tests,
`sort-preserves-selection.spec.js`. Drag-to-reorder specifically exercises
Step 10's `attribDragstarted`/`attribDragged`/`attribDragended` family and the
`this`-preservation in their wrapper.

- [ ] **Step 12: Commit**

```bash
git add src/navio.js
git commit -m "Convert the pointer, brush and drag-to-reorder handlers to take geom"
```

---

## Task 4: Convert `drawItem` and `updateLevel`, and benchmark

**Files:**
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `geom`, `drawLevelBorder(geom, i)` (Task 2).
- Produces: `drawItem(geom, rowIdx, level)`, `updateLevel(geom, levelData, i)`.

- [ ] **Step 1: Convert `drawItem` — destructure at entry (hot-path rule)**

Before:

```js
  function drawItem(rowIdx, level) {
    const item = data[rowIdx];
    let attrib, i, y;

    const drawn = visibleAttribs();
    context.save();
    for (i = 0; i < drawn.length; i++) {
      attrib = drawn[i];
      ...
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(yScales[level].bandwidth()) * pixelRatio)
      );
      y = snapToDevice(
        yScales[level](idOf(rowIdx)) + yScales[level].bandwidth() / 2,
        deviceWidth
      );

      const aStart = Math.round(x(attribName, level)),
        aEnd = Math.round(x(attribName, level) + xScale.bandwidth()),
        p0 = toXY(aStart, y),
        p1 = toXY(aEnd, y);
      ...
      context.lineWidth = deviceWidth / pixelRatio;
      ...
      if (yScales[level].bandwidth() > nv.divisionsThreshold * 2) {
        let yLine = Math.round(yScales[level](idOf(rowIdx)));
        const d0 = toXY(x(attribName, level), yLine),
          d1 = toXY(x(attribName, level) + xScale.bandwidth(), yLine);
        ...
```

After — every `geom.*` call replaced with a local destructured at the top,
per the measured hot-path rule (spec §6: naive per-read costs 7–10% on the
isolated loop, destructured is at parity):

```js
  function drawItem(geom, rowIdx, level) {
    const { toXY, cellA, cellR, bandwidthA, bandwidthR, snapToDevice, pixelRatio } =
      geom;
    const item = data[rowIdx];
    let attrib, i, y;

    const drawn = visibleAttribs();
    context.save();
    for (i = 0; i < drawn.length; i++) {
      attrib = drawn[i];
      ...
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * pixelRatio())
      );
      y = snapToDevice(
        cellR(idOf(rowIdx), level) + bandwidthR(level) / 2,
        deviceWidth
      );

      const aStart = Math.round(cellA(attribName, level)),
        aEnd = Math.round(cellA(attribName, level) + bandwidthA()),
        p0 = toXY(aStart, y),
        p1 = toXY(aEnd, y);
      ...
      context.lineWidth = deviceWidth / pixelRatio();
      ...
      if (bandwidthR(level) > nv.divisionsThreshold * 2) {
        let yLine = Math.round(cellR(idOf(rowIdx), level));
        const d0 = toXY(cellA(attribName, level), yLine),
          d1 = toXY(cellA(attribName, level) + bandwidthA(), yLine);
        ...
```

`pixelRatio` is destructured as a function reference and called (`pixelRatio()`),
same as every other destructured method — it is a method on `geom`, not a
value, precisely so it keeps reading the live binding.

- [ ] **Step 2: Convert `updateLevel`**

```js
  function updateLevel(geom, levelData, i) {
    drawLevelBorder(geom, i);
    for (let rep of levelData.representatives) {
      drawItem(geom, rep, i);
    }

    drawLevelConnections(i); // converted in Task 5
  }
```

- [ ] **Step 3: Update `updateLevel`'s one caller**

In `nv.update` (`src/navio.js`), find:

```js
    for (let i = 0; i < dataIs.length; i++) {
      updateLevel(dataIs[i], i);
    }
```

Change to:

```js
    for (let i = 0; i < dataIs.length; i++) {
      updateLevel(geom, dataIs[i], i);
    }
```

- [ ] **Step 4: Benchmark, per spec §6's required harness**

This is not optional — CLAUDE.md: *"Measure performance claims; do not reason
about them."* Use full `nv.hardUpdate()` calls on a fixed dataset, not a
microbenchmark of `drawItem` alone (canvas drawing dominates a microbenchmark
by orders of magnitude and would hide a real regression).

```bash
cat > /tmp/bench-task4.html <<'HTML'
<!doctype html>
<div id="nv"></div>
<script src="/node_modules/d3/dist/d3.js"></script>
<script src="/node_modules/popper.js/dist/umd/popper.js"></script>
<script src="/dist/navio.js"></script>
<script>
  const N = 100000;
  const data = Array.from({ length: N }, (_, i) => ({
    id: i, a: Math.random(), b: Math.random() > 0.5 ? "x" : "y",
  }));
  window.nv = new navio(d3.select("#nv"), 600);
  nv.id("id");
  nv.data(data);
  nv.addAllAttribs();
  window.__bench = () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) nv.hardUpdate();
    return performance.now() - t0;
  };
</script>
HTML
cp /tmp/bench-task4.html test/e2e/fixtures/bench-task4.html
npm run build > /tmp/build.log 2>&1; echo "BUILD EXIT: $?"
```

Then, using `mcp__claude-in-chrome` or a small Playwright script against
`http://localhost:4190/test/e2e/fixtures/bench-task4.html` (start the preview
server per `test/e2e/playwright.config.js` conventions), call
`window.__bench()` **twice** — once on this branch, once on `git stash` back
to before Task 4 — and record both numbers, wall-clock, same machine. Report
in the commit message as `before: N ms / 100 updates, after: M ms / 100
updates`. Delete `test/e2e/fixtures/bench-task4.html` before committing — it
is a scratch fixture, not part of the suite (`CLAUDE.md`: temporary probe
files belong outside the repo, or are deleted before committing).

- [ ] **Step 5: Full gate**

```bash
npm run check > /tmp/check4.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e4.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`.

- [ ] **Step 6: Commit**

```bash
git add src/navio.js
git commit -m "Convert drawItem and updateLevel to take geom, destructured at entry

before: <N> ms / 100 hardUpdate() calls at n=100000, h=600
after:  <M> ms / 100 hardUpdate() calls at n=100000, h=600"
```

---

## Task 5: Convert the level renderers — links, lines, connections, counts

**Files:**
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `geom`.
- Produces: `drawLinks(geom)`, `drawLink(geom, link)`, `drawLevelConnections(geom, level)`,
  `drawCounts(geom, levelOverlay, levelOverlayEnter)`, `drawFilterExplanationsHTML(geom)`.
  `drawLine` is unchanged — it takes already-resolved screen points and has no
  geometry of its own.

- [ ] **Step 1: `drawLink` and `drawLinks`**

Before:

```js
  function drawLink(link) {
    let lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = x(lastAttrib, dataIs.length - 1) + xScale.bandwidth() + 2,
      ys =
        yScales[dataIs.length - 1](idOf(indexOfRow(link.source))) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      yt =
        yScales[dataIs.length - 1](idOf(indexOfRow(link.target))) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      ...
```

After:

```js
  function drawLink(geom, link) {
    const lastLevel = dataIs.length - 1;
    const visible = visibleAttribs();
    let lastAttrib = getAttribName(visible[visible.length - 1]),
      rightBorder = geom.cellA(lastAttrib, lastLevel) + geom.bandwidthA() + 2,
      ys = geom.cellR(idOf(indexOfRow(link.source)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      yt = geom.cellR(idOf(indexOfRow(link.target)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      ...
```

```js
  function drawLinks(geom) {
    if (!links.length) return;
    ...
    for (let link of visibleLinks) {
      drawLink(geom, link);
    }
    ...
```

Update `drawLinks`'s one caller in `nv.update` (`drawLinks();` → `drawLinks(geom);`).

- [ ] **Step 2: `drawLevelConnections`**

Before (geometry-touching lines only):

```js
      let locPrevLevel = {
        x: levelScale(level - 1) + xScale.range()[1],
        y: yScales[level - 1](idOf(dataIs[level - 1][iRep])),
      };
      let locLevel = {
        x: levelScale(level),
        y: yScales[level](idOf(item)),
      };
      ...
        { x: locLevel.x, y: locLevel.y + yScales[level].bandwidth() },
        ...
          y: locPrevLevel.y + yScales[level - 1].bandwidth(),
        ...
      const path = points.map((pt) => toXY(pt.x, pt.y));
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
```

After:

```js
  function drawLevelConnections(geom, level) {
    if (level <= 0) return;
    for (let item of dataIs[level].representatives) {
      let iOnPrev = posAt(item, level - 1);
      let iRep = Math.floor(
        iOnPrev - (iOnPrev % dataIs[level - 1].itemsPerpixel)
      );
      let locPrevLevel = {
        x: geom.levelStartA(level - 1) + geom.levelExtentA(),
        y: geom.cellR(idOf(dataIs[level - 1][iRep]), level - 1),
      };
      let locLevel = {
        x: geom.levelStartA(level),
        y: geom.cellR(idOf(item), level),
      };

      let points = [
        locPrevLevel,
        { x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y },
        { x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y },
        locLevel,
        { x: locLevel.x, y: locLevel.y + geom.bandwidthR(level) },
        {
          x: locLevel.x - nv.levelsSeparation * 0.3,
          y: locLevel.y + geom.bandwidthR(level),
        },
        {
          x: locPrevLevel.x + nv.levelsSeparation * 0.3,
          y: locPrevLevel.y + geom.bandwidthR(level - 1),
        },
        {
          x: locPrevLevel.x,
          y: locPrevLevel.y + geom.bandwidthR(level - 1),
        },
        locPrevLevel,
      ];
      const path = points.map((pt) => geom.toXY(pt.x, pt.y));
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
    }
  }
```

Update `updateLevel` (Task 4) to call `drawLevelConnections(geom, i)` instead
of `drawLevelConnections(i)`.

- [ ] **Step 3: `drawCounts`**

**Correction, found during Task 5's dispatch, not in the original draft of
this step:** the before/after code below this line previously showed
`drawFilterExplanationsHTML`'s `levelRight` snippet under the `drawCounts`
heading — a copy-paste error at plan-writing time. Task 1's own interface
table (§4) had the correct attribution all along
(`` `levelStartA(level)` ... `drawFilterExplanationsHTML`'s `levelRight`
(`2090`), `drawCounts` (`2050`) ``); this step's code did not match it. The
real `drawCounts` (`src/navio.js:2033-2057`) is shown correctly below.
`drawFilterExplanationsHTML` was never assigned to any task in this plan as a
result of the same error — Step 3a below covers it.

Before:

```js
  function drawCounts(levelOverlay, levelOverlayEnter) {
    const vertical = isVertical();
    // Along A: the level's own leading edge, or just past its columns.
    const alongA = (i) =>
      vertical ? levelScale(i) + xScale.range()[1] + 15 : levelScale(i);
    // Along R: just past the records, or at the point where they start.
    const alongR = (i) =>
      vertical ? yScales[i].range()[0] : yScales[i].range()[1] + 15;

    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("fill", theme().ink)
      .style("pointer-events", "none")
      .attr("x", function (_, i) {
        return toXY(alongA(i), alongR(i)).x;
      })
      .attr("y", function (_, i) {
        return toXY(alongA(i), alongR(i)).y;
      })
      .text(function (d) {
        return nv.fmtCounts(d.length);
      });
  }
```

After:

```js
  function drawCounts(geom, levelOverlay, levelOverlayEnter) {
    const vertical = geom.isVertical();
    const alongA = (i) =>
      vertical
        ? geom.levelStartA(i) + geom.levelExtentA() + 15
        : geom.levelStartA(i);
    const alongR = (i) =>
      vertical
        ? geom.recordAxisStart()
        : geom.recordAxisStart() + geom.recordExtent() + 15;

    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("fill", theme().ink)
      .style("pointer-events", "none")
      .attr("x", function (_, i) {
        return geom.toXY(alongA(i), alongR(i)).x;
      })
      .attr("y", function (_, i) {
        return geom.toXY(alongA(i), alongR(i)).y;
      })
      .text(function (d) {
        return nv.fmtCounts(d.length);
      });
  }
```

(`yScales[i].range()[0]` is `geom.recordAxisStart()`; `yScales[i].range()[1]`
is `geom.recordAxisStart() + geom.recordExtent()` — every level shares the
same y-range, established in Task 2's review.)

Update `drawCounts`'s caller in `drawBrushes` (Task 3):
`drawCounts(levelOverlay, levelOverlayEnter);` →
`drawCounts(geom, levelOverlay, levelOverlayEnter);`.

- [ ] **Step 3a: `drawFilterExplanationsHTML`**

Not in the original draft of this task — added for the reason in Step 3's
correction note. Single caller (`drawBrushes`, `src/navio.js:2680`), geom
visible via closure exactly as for `drawCounts`.

Before (geometry-touching lines, `src/navio.js:2084-2208`):

```js
    const levelRight = (level) => levelScale(level) + xScale.range()[1] + 4;
    const explanationWidth = (level) =>
      level < dataIs.length - 1
        ? Math.max(70, levelRight(level + 1) - levelRight(level) - 8)
        : Math.max(220, xScale.range()[1]);
    ...
        const p = toXY(levelRight(i), yScales[i].range()[1] + 16);
        return `translate(${p.x}px, ${p.y}px)`;
```

After:

```js
  function drawFilterExplanationsHTML(geom) {
    const levelRight = (level) =>
      geom.levelStartA(level) + geom.levelExtentA() + 4;
    const explanationWidth = (level) =>
      level < dataIs.length - 1
        ? Math.max(70, levelRight(level + 1) - levelRight(level) - 8)
        : Math.max(220, geom.levelExtentA());
    ...
        const p = geom.toXY(
          levelRight(i),
          geom.recordAxisStart() + geom.recordExtent() + 16
        );
        return `translate(${p.x}px, ${p.y}px)`;
```

Update its one caller in `drawBrushes`:
`drawFilterExplanationsHTML();` → `drawFilterExplanationsHTML(geom);`.

- [ ] **Step 4: Benchmark the links path (spec §6's flagged-unmeasured case)**

```bash
cat > /tmp/bench-links.html <<'HTML'
<!doctype html>
<div id="nv"></div>
<script src="/node_modules/d3/dist/d3.js"></script>
<script src="/node_modules/popper.js/dist/umd/popper.js"></script>
<script src="/dist/navio.js"></script>
<script>
  const N = 5000;
  const data = Array.from({ length: N }, (_, i) => ({ id: i, a: Math.random() }));
  const links = Array.from({ length: N }, (_, i) => ({
    source: i, target: (i + 1) % N,
  }));
  window.nv = new navio(d3.select("#nv"), 600);
  nv.id("id");
  nv.data(data);
  nv.addAllAttribs();
  nv.links(links);
  window.__bench = () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) nv.hardUpdate();
    return performance.now() - t0;
  };
</script>
HTML
```

The public method is `nv.links(links)` (`src/params.js:639-640`, confirmed
while writing this plan — not `setLinks`). Run the same before/after
comparison as Task 4 Step 4,
record it in the commit message, then delete the scratch fixture.

- [ ] **Step 5: Full gate**

```bash
npm run check > /tmp/check5.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e5.log 2>&1; echo "EXIT: $?"
```

Run `test/e2e/61-link-endpoints.spec.js` specifically — CLAUDE.md documents
that link-endpoint resolution must not be cached, and this task touches the
function that draws them.

- [ ] **Step 6: Commit**

```bash
git add src/navio.js
git commit -m "Convert the link and level-connection renderers to take geom

links benchmark: before <N> ms, after <M> ms / 100 hardUpdate() at 5000 links"
```

---

## Task 6: Convert the attribute-header renderers

**Files:**
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `geom`.
- Produces: `drawAttribHeaders(geom, attribOverlay, attribOverlayEnter, headerHit)`,
  `drawAttributesHolders(geom, levelOverlay, levelOverlayEnter)`,
  `measureHeaderBand(geom)`.

`grownFontSize`, `growHeaderLabel`, `applyHeaderBand` are **not** converted.
`growHeaderLabel` was in the design's original sketch of this task but has no
geometry at all — its body (`src/navio.js:2261-2278`) does a `d3.select`/
`svg.selectAll` lookup and calls `grownFontSize`, `nv.attribFontSize`,
`nv.attribWidth`; none of that touches `xScale`/`yScales`/`levelScale`.
`grownFontSize` is pure typography math with no geometry-object dependency
beyond `bandwidthA()` (passed as a plain number in some call paths, not
`geom` itself); `applyHeaderBand` computes `headerSpill`/`nv.y0` and is a
derive-phase function, explicitly out of scope per this plan's Global
Constraints correction. **`drawAttribHeaders`'s `.on("start"/"drag"/"end",
...)` registration was already converted in Task 3 Step 10 — do not re-touch
those three lines here.** Only the label-positioning geometry below is this
task's to convert.

- [ ] **Step 1: `drawAttribHeaders`**

Replace every `xScale.bandwidth()` with `geom.bandwidthA()` and every
`isVertical()` with `geom.isVertical()` inside the function body
(`src/navio.js`, lines `2438-2439`, `2470`-region). Add `geom` as the first
parameter. Update its one caller in `drawAttributesHolders`.

- [ ] **Step 2: `drawAttributesHolders`**

Replace:

```js
      const p = toXY(x(d.name, d.level), yScales[d.level].range()[0]);
      ...
        return toWH(
          xScale.bandwidth() * 1.1,
          yScales[d.level].range()[1] - yScales[d.level].range()[0]
        );
      ...
      Math.max(0, yScales[level].range()[0] - nv.margin);
      ...
      .attr("x", (d) => toXY(0, -hitDepth(d.level)).x)
      .attr("y", (d) => toXY(0, -hitDepth(d.level)).y)
      ...
      .attr("width", (d) => toWH(xScale.step(), hitDepth(d.level)).width)
      .attr("height", (d) => toWH(xScale.step(), hitDepth(d.level)).height);
```

with:

```js
      const p = geom.toXY(geom.cellA(d.name, d.level), geom.recordAxisStart());
      ...
        return geom.toWH(geom.bandwidthA() * 1.1, geom.recordExtent());
      ...
      Math.max(0, geom.recordAxisStart() - nv.margin);
      ...
      .attr("x", (d) => geom.toXY(0, -hitDepth(d.level)).x)
      .attr("y", (d) => geom.toXY(0, -hitDepth(d.level)).y)
      ...
      .attr("width", (d) => geom.toWH(geom.stepA(), hitDepth(d.level)).width)
      .attr("height", (d) => geom.toWH(geom.stepA(), hitDepth(d.level)).height);
```

(`yScales[d.level].range()[1] - yScales[d.level].range()[0]` is exactly
`recordExtent()` by definition — both bounds shift by the same `recordAxisStart()`.)

Update its caller in `drawBrushes` (Task 3):
`drawAttributesHolders(levelOverlay, levelOverlayEnter);` →
`drawAttributesHolders(geom, levelOverlay, levelOverlayEnter);`.

- [ ] **Step 3: `measureHeaderBand`**

Reads `xScale.bandwidth()` at `src/navio.js:2323` for sizing math — replace
with `geom.bandwidthA()`, add `geom` as a parameter, update the one call site
in `applyHeaderBand` (which itself stays unconverted, per this task's own
first paragraph, but still must pass `geom` through since it calls
`measureHeaderBand`):

`grownFontSize` also reads `xScale.bandwidth()`, at line `2242` — but directly
via closure, the same way it already reads `isVertical()`, `nv.y0` and
`headerSpill`. It needs **no change at all**: `xScale` stays a closure binding
after this plan (Task 7's correction), so `grownFontSize` keeps working
exactly as it does today, unconverted. Do not add `geom` to it.

```js
  function applyHeaderBand() {
    if (!nv.autoHeaderSpace) {
      headerSpill = 0;
      return false;
    }
    const band = measureHeaderBand(geom);
    ...
```

- [ ] **Step 4: Full gate**

```bash
npm run check > /tmp/check6.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e6.log 2>&1; echo "EXIT: $?"
```

Run `test/e2e/103-header-space.spec.js` specifically — it is the largest
header-band spec (15 tests) and the most likely to catch a header-geometry
regression.

- [ ] **Step 5: Commit**

```bash
git add src/navio.js
git commit -m "Convert the attribute-header renderers to take geom"
```

---

## Task 7: Delete what can be deleted, and prove the rest is unreachable

Per this plan's opening correction: `xScale`, `yScales`, `levelScale`,
`height`, `pixelRatio` **stay** in `navio.js`'s `let` chain — `init()`,
`updateScales()` and `updateWidthAndHeight()` still own and mutate them
directly, and are not conversion targets. What this task actually deletes:
`x` (fully superseded by `geom.cellA`) and `invertScaleCache`/
`invalidateInvertCache` (moved into `geometry.js` in Task 1).

**Files:**
- Modify: `src/navio.js`
- Create: `test/e2e/geometry-injection.spec.js`

**Interfaces:**
- Consumes: `geom`, and every conversion from Tasks 2–6.

- [ ] **Step 1: Confirm zero remaining callers of `x`, `invertOrdinalScale`, `invalidateInvertCache`**

```bash
node -e '
const fs = require("fs");
const s = fs.readFileSync("src/navio.js", "utf8");
for (const n of ["invertOrdinalScale", "invalidateInvertCache", "invertScaleCache"]) {
  const m = s.match(new RegExp("(^|[^.\\w$])" + n + "\\b", "g")) || [];
  console.log(n, m.length);
}
'
```

Expected: every count is exactly the declaration site inside `geometry.js`
plus zero in `navio.js` (they should already be zero in `navio.js`, since
Tasks 1–6 moved every caller to `geom.attribAtA`/`geom.rowAtR`/
`geom.levelAtA`/`geom.invalidateInvertCache`). If any remain, find and convert
them before proceeding — do not delete the bindings with a caller still
present.

For `x` specifically:

```bash
node -e '
const fs = require("fs");
const s = fs.readFileSync("src/navio.js", "utf8");
const m = s.match(/(^|[^.\w$])x\(/g) || [];
console.log("x( call sites:", m.length);
'
```

Expected: `0`. (`invertOrdinalScale`'s own shadowing parameter named `x` is
gone along with the function itself.)

- [ ] **Step 2: Delete `x`, `invertScaleCache`, `invalidateInvertCache` from `navio.js`**

Remove the `x = function (val, level) { ... }` assignment (`src/navio.js:935-937`)
and its declaration from the `let` chain. Remove `invertOrdinalScale`
(`1000-1007`) and `invalidateInvertCache` (`1015-1017`) entirely, and remove
`invertScaleCache` from the `let` chain (`declared` near line `86`). Remove the
one remaining call `invalidateInvertCache();` in `updateScales` (`3197`) and
replace it with `geom.invalidateInvertCache();`.

- [ ] **Step 3: `nv.destroy` teardown**

`nv.destroy` currently does `yScales = [];` (`src/navio.js:4115`) as part of
dropping references so the closure stops pinning data in memory. That line
stays exactly as-is — `yScales` is still a live `navio.js` binding, and
`geom`'s `get yScales()` getter (Task 1) means `geom` immediately reflects the
empty array after this line runs, with nothing left reachable through `geom`
from the pre-destroy scales. This is what Task 1's regression test (Step 5
below) proves directly, rather than trusting it.

- [ ] **Step 4: Write the destroy-safety regression test**

Create `test/e2e/geometry-injection.spec.js`:

```js
import { test, expect } from "@playwright/test";

// Pins geom's construction contract (see src/geometry.js and
// docs/ai/2026-08-21-navio-geometry-injection-design.md section 3).
//
// yScales is REASSIGNED wholesale by nv.destroy() (`yScales = []`), not
// mutated in place. A geom that had captured the array by VALUE at
// construction would keep the entire pre-destroy scale array - and every
// scale object and domain in it - reachable through geom forever, which is a
// memory leak specific to a correctly-functioning geom, not a bug in
// destroy() itself. geom must read yScales through a getter so that after
// destroy() it sees the same empty array navio.js itself sees.
test("geom sees the same yScales navio.js sees, including after destroy()", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const beforeLength = await page.evaluate(() => window.nv.getVisibleLinks().length);
  expect(beforeLength, "sanity: widget has rendered at least once").toBe(0);

  await page.evaluate(() => window.nv.destroy());

  // Rebuilding on the same container must not throw or warn - the strongest
  // externally-observable proof that nothing internal is still pointing at
  // stale scale state from before destroy().
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    // window.d3, not bare d3 - the convention test/e2e/59-destroy.spec.js uses.
    window.nv2 = new window.navio(window.d3.select("#nv"), 400);
    window.nv2.id("id");
    window.nv2.data([{ id: 1, category: "a", value: 10 }]);
    window.nv2.addAllAttribs();
  });
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(errors, "rebuilding after destroy() threw").toEqual([]);
});

// The mechanism's actual justification (spec section 1): a hit-test must read
// CURRENT geometry, not geometry captured when the level was created.
//
// single.html's rows are id 1..5 with value 10, 20, 30, 15, 25 - ascending
// value order is 10,15,20,25,30 -> ids "1 4 2 5 3". getRowsAtLevel is the
// same real-reorder check
// test/e2e/81-sortby-actually-sorts.spec.js uses for nv.sortBy(); this proves
// the CLICK path resolves to the same column after geometry has changed.
const order = (page) =>
  page.evaluate(() =>
    window.nv
      .getRowsAtLevel(0)
      .map((d) => d.id)
      .join(" ")
  );

test("clicking a header sorts correctly after the attribute width changes", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() => {
    // attribWidth is a plain option property (src/params.js:51-53), not a
    // method - confirmed while writing this plan.
    window.nv.attribWidth = 80;
    window.nv.hardUpdate();
  });

  // Click the "value" column's header label - if geom's levelAtA/attribAtA
  // read stale geometry from before the width change, this click resolves to
  // the wrong column (or none), and the row order below is unaffected.
  const labels = page.locator("#nv svg .attribOverlay text");
  await expect(labels).toContainText("value");
  await labels.filter({ hasText: "value" }).first().click();

  await expect(async () => {
    expect(await order(page)).toBe("1 4 2 5 3");
  }).toPass();
});
```

`labels.filter({ hasText: "value" })` and `getRowsAtLevel` are both used
elsewhere in the suite (`test/e2e/103-header-space.spec.js:361`,
`test/e2e/81-sortby-actually-sorts.spec.js`) — reused here rather than
inventing new selectors. `nv.getVisibleLinks()` (used in the destroy test
above) is confirmed to exist at `src/navio.js:3929`.

- [ ] **Step 5: Prove it fails without the fix**

Per `CLAUDE.md`: a test not proven to fail without the fix is worth nothing.
Temporarily change `geometry.js`'s `ctx.yScales` consumer sites to capture
`const yScales = ctx.yScales;` once at `createGeometry` construction time
instead of reading `ctx.yScales` per call, rerun the first test, confirm it
now fails (rebuilding after destroy throws or the rendered canvas is wrong),
then revert.

```bash
NAVIO_TEST_PORT=4190 npx playwright test test/e2e/geometry-injection.spec.js
```

- [ ] **Step 6: Full gate**

```bash
npm run check > /tmp/check7.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e7.log 2>&1; echo "EXIT: $?"
```

`eslint`'s `no-undef` (`js.configs.recommended`) is what catches a bare `x` or
`invertOrdinalScale` reader left behind after deletion — confirm `npm run
check` actually fails if you temporarily leave one in, the same
prove-it-fails discipline as Step 5.

- [ ] **Step 7: Commit**

```bash
git add src/navio.js test/e2e/geometry-injection.spec.js
git commit -m "Delete x and the invert-scale cache; geom now owns inversion

xScale, yScales, levelScale, height and pixelRatio stay in navio.js's let
chain - init(), updateScales() and updateWidthAndHeight() still own and
mutate them directly and were never conversion targets."
```

---

## Task 8: Move files into directories, correct `CLAUDE.md`

**Files:**
- Create: `src/chrome/` (move `settings-panel.js`, `settings-storage.js`, `theme.js`)
- Modify: `src/navio.js`, `src/geometry.js` — import path updates only
- Modify: `CLAUDE.md`
- Modify: `docs/ai/2026-08-21-navio-geometry-injection-design.md` — mark implemented

Per the maintainer's semantics-first instruction and the design's §9: `geom`
stays at `src/geometry.js` (a leaf, not part of the `chrome/` UI group).
`attributes/`, `records/`, `levels/`, `filtering/` from the design's directory
map are **not** created in this task — only `chrome/` has three files ready to
move today (`settings-panel.js`, `settings-storage.js`, `theme.js`); the
others remain single files inside `src/navio.js` and are future extractions,
not renames.

- [ ] **Step 1: Move the three chrome files**

```bash
mkdir -p src/chrome
git mv src/settings-panel.js src/chrome/settings-panel.js
git mv src/settings-storage.js src/chrome/settings-storage.js
git mv src/theme.js src/chrome/theme.js
```

- [ ] **Step 2: Fix the three import paths**

```bash
node -e '
const fs = require("fs");
for (const [file, from] of [
  ["src/navio.js", "./settings-panel.js"],
  ["src/navio.js", "./settings-storage.js"],
  ["src/navio.js", "./theme.js"],
]) {
  let s = fs.readFileSync(file, "utf8");
  const to = from.replace("./", "./chrome/");
  s = s.split(from).join(to);
  fs.writeFileSync(file, s);
}
'
node -e '
const fs = require("fs");
for (const f of ["src/chrome/settings-panel.js"]) {
  let s = fs.readFileSync(f, "utf8");
  s = s.split(`from "./theme.js"`).join(`from "./theme.js"`); // same dir, unchanged
  s = s.split(`from "./settings-storage.js"`).join(`from "./settings-storage.js"`); // same dir, unchanged
  fs.writeFileSync(f, s);
}
'
```

(`settings-panel.js`'s own imports of `theme.js` and `settings-storage.js` do
not change — all three now live in the same `src/chrome/` directory, so their
relative import stays `./theme.js` / `./settings-storage.js`.)

- [ ] **Step 3: Update `CLAUDE.md`'s Layout block**

```
src/settings-panel.js   the gear, the panel, and everything drawn in it.
```
becomes
```
src/chrome/settings-panel.js   the gear, the panel, and everything drawn in it.
```

(and likewise for the other two lines). Add a `src/geometry.js` line: *"navio's
coordinate system - forward and inverse mapping between (attribute, record)
and screen. A leaf: imports only d3."*

- [ ] **Step 3a: Mark the design doc implemented**

`docs/ai/2026-08-21-navio-geometry-injection-design.md` line 9 currently
reads:

```
**Status:** design only. Nothing here is implemented.
```

Replace with:

```
**Status:** implemented. See
`docs/superpowers/plans/2026-08-21-navio-geometry-injection.md` (Tasks 1-8)
for what actually landed and where it diverged from this design (the plan's
"Corrections found while writing this plan" section, and each task's own
notes).
```

- [ ] **Step 4: Full gate**

```bash
npm run check > /tmp/check8.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e8.log 2>&1; echo "EXIT: $?"
```

- [ ] **Step 5: Commit**

```bash
git add -A src/ CLAUDE.md
git commit -m "Move the settings/theme modules into src/chrome/, and document geometry.js"
```

---

## Self-Review

**Spec coverage:** §1 (pipeline) → plan intro. §2 (construction facts) → Global
Constraints. §3 (interface + both membership criteria + construction contract)
→ Task 1, extended with the six additional primitives found by tracing every
real call site. §4 (scale of the change) → the call-site evidence column in
Task 1's interface table. §5 (renderer signatures, `state` bag concession) →
Tasks 2–6 show every real signature rather than the spec's three illustrative
ones. §6 (performance, destructure-at-entry, benchmark harness) → Task 4 Step
1 and Step 4, Task 5 Step 4. §7 (no API change) → Global Constraints. §8
(sequencing) → Tasks 2–7, in the spec's order, with step 3's "handlers first"
followed and its `this`-binding note followed exactly (Task 3 Step 6). §9
(directory map) → Task 8, scoped down to what is actually ready today. §10
(risks) → addressed inline: god-object risk avoided by the two-criteria test
staying in force for the six additions; orientation risk addressed by keeping
`isVertical()` a function throughout.

**Not covered, by design:** the `attributes/`, `records/`, `levels/`,
`filtering/` directories from spec §9 — future extractions, not renames, and
out of this plan's scope per its own File Structure section.

**Placeholder scan:** every code block above is real, taken from or derived
from the actual `src/navio.js` source at commit `ca40f41` — none is
"similar to Task N" or hand-waved. The one place that needs a human-supplied
number rather than code is the benchmark results in Tasks 4 and 5 commit
messages, which cannot be known until the benchmark actually runs.

**Type consistency:** `geom`'s eighteen method names are used identically
across every task (`cellA`, `cellR`, `bandwidthA`, `bandwidthR`, `stepA`,
`levelStartA`, `levelExtentA`, `recordAxisStart`, `extentA`, `recordExtent`,
`pixelRatio`, `snapToDevice`, `attribAtA`, `rowAtR`, `levelAtA`, `toXY`,
`toWH`, `isVertical`, plus `invalidateInvertCache`) — cross-checked against
Task 1's own definitions before writing Tasks 2–7.
