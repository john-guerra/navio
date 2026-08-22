# Canvas Renderer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the seven canvas painters out of `src/navio.js` into
`src/render/canvas.js`, and fix issue #111's measured hot-path regression while
the same code is open.

**Architecture:** `createCanvasRenderer(ctx)` in a new `src/render/canvas.js`,
built once in the closure after the settings module is destructured. Its `ctx`
follows the same contract `geom` established: bindings the closure rebinds
(`context`, `data`, `dataIs`, `links`, `visibleLinks`, `selectedFlags`,
`colScales`) cross as getters; bindings it never rebinds (`nv`, the hoisted
function declarations, the `const`s from settings) cross as plain values. `geom`
stays a per-call parameter, not a `ctx` entry. Functions move in four stages so
every commit is independently green and reviewable.

**Tech Stack:** ES modules, vitest for the construction contract, Playwright for
canvas behaviour and the benchmark. No new dependencies — the module imports
nothing, not even d3.

**Spec:** `docs/ai/2026-08-21-navio-canvas-renderer-design.md` — read it first,
especially §3 (the ctx table), §4 (the performance constraint), §5 (what must
not change).

## Global Constraints

- **Behaviour-preserving.** No API change, no new option. `src/params.js` and
  `docs/ai/API.md` are untouched by this plan.
- **The construction contract (spec §3.1):** anything the closure rebinds
  crosses as a getter, with no exception. The seven getters are `context`,
  `data`, `dataIs`, `links`, `visibleLinks`, `selectedFlags`, `colScales`.
  Plain values: `nv`, `idOf`, `getAttrib`, `getAttribName`, `visibleAttribs`,
  `indexOfRow`, `posAt`, `isMissing`, `theme`, `divisionsColour`.
- **`geom` is a parameter, never a ctx entry.** Every moved function already
  takes it.
- **Destructure at entry, never inside a loop.** A getter read is a function
  call; per-attribute is the wrong frequency (spec §4).
- **Do not cache resolved link endpoints.** `CLAUDE.md`'s landmine: `drawLink`
  must keep resolving `link.source`/`link.target` through `indexOfRow` on every
  call. `test/e2e/61-link-endpoints.spec.js` pins it.
- **`drawLine` takes already-mapped SCREEN points.** It is not a geometry
  consumer and must not gain a `geom` parameter.
- **Gate per task:** `npm run check` **and**
  `NAVIO_TEST_PORT=4190 npx playwright test` must both pass before the next task
  begins. `npm run check` does not run e2e.
- **Check exit codes, never grep output.**
  `npm run build > /tmp/x.log 2>&1; echo "EXIT: $?"` — a rollup `SyntaxError`
  prints capitalised and does not match a grep for `error`.
- **`grep`/`fgrep` in this environment do not support `\|` alternation.** Search
  one identifier per call, or use a `node` script with `acorn`.
- **Commit each task separately.** Do not batch.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/render/canvas.js` | **New.** Every function that draws to the 2D context. Imports nothing. Returns `{ updateLevel, drawLinks }` once complete. |
| `src/navio.js` | Loses 208 lines of painting. Keeps owning the scales, the level chain and the update pipeline. |
| `test/unit/canvas-renderer.test.js` | **New.** The construction contract only — that the module reads rebound bindings live. |
| `CLAUDE.md` | Layout block gains `src/render/canvas.js`. |

---

## Task 1: Build the module, move `drawLine`, prove the contract

`drawLine` is the right first mover: 20 lines, takes no `geom`, and reads
exactly one ctx binding (`context`). Moving it proves the wiring end-to-end
without risking geometry.

**Files:**
- Create: `src/render/canvas.js`
- Create: `test/unit/canvas-renderer.test.js`
- Modify: `src/navio.js` (delete `drawLine` at `2856-2875`, add the construction
  and one call-site update)

**Interfaces:**
- Produces: `createCanvasRenderer(ctx)` returning `{ drawLine }`.
  `drawLine(points, width, color, close)` — `points` is an array of
  `{x, y}` SCREEN coordinates, already mapped through `geom.toXY` by the caller.

- [ ] **Step 1: Write the failing test**

Create `test/unit/canvas-renderer.test.js`:

```js
import { describe, it, expect } from "vitest";
import { createCanvasRenderer } from "../../src/render/canvas.js";

// A recording 2D context: enough surface for the painters to run real code
// rather than stubs, and to assert the exact call order they produce.
function fakeContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    closePath: () => calls.push(["closePath"]),
    moveTo: (x, y) => calls.push(["moveTo", x, y]),
    lineTo: (x, y) => calls.push(["lineTo", x, y]),
    stroke: () => calls.push(["stroke"]),
    fill: () => calls.push(["fill"]),
    set lineWidth(v) {
      calls.push(["lineWidth", v]);
    },
    set strokeStyle(v) {
      calls.push(["strokeStyle", v]);
    },
    set fillStyle(v) {
      calls.push(["fillStyle", v]);
    },
  };
}

function buildCtx(overrides = {}) {
  return {
    nv: { DEBUG: false, ...overrides.nv },
    context: overrides.context,
    data: [],
    dataIs: [],
    links: [],
    visibleLinks: [],
    selectedFlags: new Uint8Array(0),
    colScales: new Map(),
    idOf: (i) => i,
    getAttrib: (row, a) => row[a],
    getAttribName: (a) => a,
    visibleAttribs: () => [],
    indexOfRow: (r) => r,
    posAt: () => 0,
    isMissing: (v) => v === undefined || v === null,
    theme: () => ({ border: "#000" }),
    divisionsColour: () => "#ccc",
    ...overrides,
  };
}

describe("createCanvasRenderer construction contract", () => {
  it("drawLine strokes an open path through every point", () => {
    const context = fakeContext();
    const { drawLine } = createCanvasRenderer(buildCtx({ context }));
    drawLine(
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      2,
      "red",
      false
    );
    expect(context.calls).toEqual([
      ["beginPath"],
      ["moveTo", 1, 2],
      ["lineTo", 3, 4],
      ["lineWidth", 2],
      ["strokeStyle", "red"],
      ["stroke"],
    ]);
  });

  it("drawLine fills and closes when close is true", () => {
    const context = fakeContext();
    const { drawLine } = createCanvasRenderer(buildCtx({ context }));
    drawLine([{ x: 0, y: 0 }], 1, "blue", true);
    expect(context.calls).toEqual([
      ["beginPath"],
      ["moveTo", 0, 0],
      ["lineWidth", 1],
      ["fillStyle", "blue"],
      ["closePath"],
      ["fill"],
    ]);
  });

  // The contract this module exists to honour. `context` is assigned in
  // init() (src/navio.js:979), long after this factory is constructed, so a
  // renderer that captured ctx.context by VALUE would hold undefined forever
  // and throw on the first paint. Same class of bug as geom's yScales getter.
  it("reads the CURRENT context, not one captured at construction", () => {
    let context = null;
    const ctx = buildCtx();
    Object.defineProperty(ctx, "context", { get: () => context });
    const { drawLine } = createCanvasRenderer(ctx);

    // Constructed while context is still null - exactly navio's real order.
    context = fakeContext();
    drawLine([{ x: 7, y: 8 }], 1, "green", false);
    expect(context.calls).toContainEqual(["moveTo", 7, 8]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run test/unit/canvas-renderer.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/render/canvas.js"`.

- [ ] **Step 3: Create the module**

Create `src/render/canvas.js`:

```js
/**
 * navio's canvas painters: everything that draws to the 2D context.
 *
 * Built ONCE, in the closure, after the settings module is destructured
 * (src/navio.js:1258-1269) - `theme` and `divisionsColour` come from there.
 *
 * `context`, `data`, `dataIs`, `links`, `visibleLinks`, `selectedFlags` and
 * `colScales` are all reassigned during the widget's life - `context` in
 * init(), the rest on data changes and at destroy - so they cross as GETTERS
 * and are read at call time. Everything else here is either `nv` (never
 * rebound), a hoisted function declaration, or a `const` from the settings
 * module, and is safe as a plain value. This is the same contract
 * src/geometry.js documents, and CLAUDE.md's "a module gets GETTERS, not
 * values" landmine is about exactly this.
 *
 * `geom` is NOT a ctx entry - it is passed per call, because every one of
 * these functions already takes it.
 *
 * See docs/ai/2026-08-21-navio-canvas-renderer-design.md.
 *
 * @param {object} ctx - { nv, get context(), get data(), get dataIs(),
 *   get links(), get visibleLinks(), get selectedFlags(), get colScales(),
 *   idOf, getAttrib, getAttribName, visibleAttribs, indexOfRow, posAt,
 *   isMissing, theme, divisionsColour }
 */
export function createCanvasRenderer(ctx) {
  /**
   * Stroke or fill a path of already-mapped SCREEN points.
   *
   * This is the one painter that takes no `geom`: its caller
   * (drawLevelConnections) builds the path in (attribute, record) space and
   * maps the whole thing through geom.toXY before calling here, so by this
   * point the coordinates are screen x/y and must not be transposed again.
   */
  function drawLine(points, width, color, close) {
    const context = ctx.context;
    context.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }
    context.lineWidth = width;
    if (close) {
      context.fillStyle = color;
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = color;
      context.stroke();
    }
  }

  return { drawLine };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run test/unit/canvas-renderer.test.js
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Import and construct in `navio.js`**

Add to the imports at the top of `src/navio.js`, beside the existing
`import { createGeometry } from "./geometry.js";`:

```js
import { createCanvasRenderer } from "./render/canvas.js";
```

Immediately after the settings destructuring block that ends with
`} = settings;` (currently `src/navio.js:1269`), add:

```js
  // The canvas painters. Constructed here rather than at the top of the
  // closure because `theme` and `divisionsColour` are consts from the
  // settings module just above; everything else it needs is either `nv`, a
  // hoisted function declaration, or read through a getter at call time.
  const canvasRenderer = createCanvasRenderer({
    nv,
    get context() {
      return context;
    },
    get data() {
      return data;
    },
    get dataIs() {
      return dataIs;
    },
    get links() {
      return links;
    },
    get visibleLinks() {
      return visibleLinks;
    },
    get selectedFlags() {
      return selectedFlags;
    },
    get colScales() {
      return colScales;
    },
    idOf,
    getAttrib,
    getAttribName,
    visibleAttribs,
    indexOfRow,
    posAt,
    isMissing,
    theme,
    divisionsColour,
  });
```

- [ ] **Step 6: Delete `drawLine` from `navio.js` and update its callers**

Delete the whole `function drawLine(points, width, color, close) { ... }` block
(currently `src/navio.js:2856-2875`), including its JSDoc if present.

Its only two call sites are both inside `drawLevelConnections` (currently
`:2921-2922`):

```js
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
```
becomes
```js
      canvasRenderer.drawLine(path, 1, nv.levelConnectionsColor);
      canvasRenderer.drawLine(path, 1, nv.levelConnectionsColor, true);
```

Confirm there are no others before deleting:

```bash
node -e '
const s = require("fs").readFileSync("src/navio.js", "utf8");
console.log("drawLine refs:", (s.match(/(^|[^.\w$])drawLine\b/g) || []).length);
'
```
Expected after the edit: `0` (the two call sites are now `.drawLine`, which the
`[^.\w$]` guard excludes).

- [ ] **Step 7: Full gate**

```bash
npm run check > /tmp/check1.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e1.log 2>&1; echo "EXIT: $?"
```

Both must be `EXIT: 0`. `test/e2e/93-level-connections.spec.js` does not exist;
the specs that exercise `drawLine` are the multi-level drill-down ones — any
spec that filters to a second level paints level connections. A full green suite
is the gate.

- [ ] **Step 8: Commit**

```bash
git add src/render/canvas.js test/unit/canvas-renderer.test.js src/navio.js
git commit -m "Build the canvas renderer module and move drawLine into it"
```

---

## Task 2: Move the four remaining private painters

**Files:**
- Modify: `src/render/canvas.js`
- Modify: `src/navio.js` (delete four functions, update their call sites)

**Interfaces:**
- Consumes: `createCanvasRenderer(ctx)` and its `ctx` from Task 1.
- Produces: `createCanvasRenderer` now also returns `drawItem(geom, rowIdx,
  level)`, `drawLevelBorder(geom, i)`, `drawLink(geom, link)`,
  `drawLevelConnections(geom, level)`. These are exposed **temporarily** so
  `navio.js`'s still-resident `updateLevel`/`drawLinks` can call them; Task 3
  makes them private again.

- [ ] **Step 1: Move `drawLevelBorder`**

Add to `src/render/canvas.js`, inside the factory, above `drawLine`:

```js
  function drawLevelBorder(geom, i) {
    const context = ctx.context;
    context.save();
    context.beginPath();
    const origin = geom.toXY(geom.levelStartA(i), geom.recordAxisStart() - 1),
      size = geom.toWH(geom.levelExtentA() + 1, geom.recordExtent() + 2);
    context.rect(origin.x, origin.y, size.width, size.height);
    context.strokeStyle = ctx.theme().border;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }
```

Delete the original from `src/navio.js` (currently `:1403-1413`). Update its one
caller inside `updateLevel` (currently `:3321`):
`drawLevelBorder(geom, i);` → `canvasRenderer.drawLevelBorder(geom, i);`

Add `rect` to the `fakeContext` in `test/unit/canvas-renderer.test.js` so the
recording context stays complete:

```js
    rect: (x, y, w, h) => calls.push(["rect", x, y, w, h]),
```

- [ ] **Step 2: Move `drawItem`**

Add to `src/render/canvas.js`:

```js
  function drawItem(geom, rowIdx, level) {
    const {
      toXY,
      cellA,
      cellR,
      bandwidthA,
      bandwidthR,
      snapToDevice,
      pixelRatio,
    } = geom;
    // Read every rebound binding ONCE here, not per attribute: each is a
    // getter, and this loop is navio's hot path (see the design's section 4).
    const context = ctx.context,
      data = ctx.data,
      selectedFlags = ctx.selectedFlags,
      colScales = ctx.colScales,
      idOf = ctx.idOf,
      getAttrib = ctx.getAttrib,
      getAttribName = ctx.getAttribName,
      isMissing = ctx.isMissing,
      divisionsColour = ctx.divisionsColour,
      nv = ctx.nv;
    const item = data[rowIdx];
    let attrib, i, y;

    const drawn = ctx.visibleAttribs();
    context.save();
    for (i = 0; i < drawn.length; i++) {
      attrib = drawn[i];
      // `selected` and `__seqId` are rendered columns but no longer row
      // properties - both are derived from the row's index. See #88.
      const val =
        attrib === "selected"
          ? !!selectedFlags[rowIdx]
          : attrib === "__seqId"
            ? rowIdx
            : getAttrib(item, attrib);
      const attribName = getAttribName(attrib);

      // A whole number of DEVICE pixels, so the stroke can sit exactly on the
      // grid. Round rather than ceil the device width: ceil in CSS units then
      // scaled would round twice and, at a fractional pixelRatio, still land
      // between pixels.
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * pixelRatio())
      );
      y = snapToDevice(
        cellR(idOf(rowIdx), level) + bandwidthR(level) / 2,
        deviceWidth
      );

      // One stroke per (record, attribute) cell: it runs the width of the
      // attribute band along A, and is as thick as one record along R.
      const aStart = Math.round(cellA(attribName, level)),
        aEnd = Math.round(cellA(attribName, level) + bandwidthA()),
        p0 = toXY(aStart, y),
        p1 = toXY(aEnd, y);
      context.beginPath();
      context.moveTo(p0.x, p0.y);
      context.lineTo(p1.x, p1.y);
      context.lineWidth = deviceWidth / pixelRatio();

      context.strokeStyle = isMissing(val)
        ? nv.nullColor
        : colScales.get(attrib)(val);

      context.stroke();

      // TODO get this out
      //If the range bands are tick enough draw divisions
      if (bandwidthR(level) > nv.divisionsThreshold * 2) {
        let yLine = Math.round(cellR(idOf(rowIdx), level));
        const d0 = toXY(cellA(attribName, level), yLine),
          d1 = toXY(cellA(attribName, level) + bandwidthA(), yLine);
        context.beginPath();
        context.moveTo(d0.x, d0.y);
        context.lineTo(d1.x, d1.y);
        context.lineWidth = 1;
        context.strokeStyle = divisionsColour();
        context.stroke();
      }
    }
    context.restore();
  } // drawItem
```

**This is a move, not a rewrite.** The only differences from the original are
the `ctx.` reads hoisted to the top and the removal of two commented-out lines
that referenced the deleted `yScales[level](item[id])`. Do not change the
arithmetic — `#105`'s pixel-grid fix lives in `snapToDevice`/`deviceWidth` and
`test/e2e/106-pixel-grid.spec.js` pins it.

Delete the original from `src/navio.js` (currently `:1326-1399`). Update its one
caller inside `updateLevel` (currently `:3323`):
`drawItem(geom, rep, i);` → `canvasRenderer.drawItem(geom, rep, i);`

- [ ] **Step 3: Move `drawLink`**

Add to `src/render/canvas.js`:

```js
  function drawLink(geom, link) {
    const context = ctx.context,
      dataIs = ctx.dataIs,
      idOf = ctx.idOf,
      indexOfRow = ctx.indexOfRow;
    const lastLevel = dataIs.length - 1;
    const visible = ctx.visibleAttribs();
    // link.source/link.target are resolved through indexOfRow on EVERY call.
    // This looks wasteful and is not safe to cache: callers mutate the link
    // array in place - d3-force rewrites source/target from ids to node
    // objects after navio has already seen them. It was tried, it regressed,
    // it was reverted; test/e2e/61-link-endpoints.spec.js pins it.
    let lastAttrib = ctx.getAttribName(visible[visible.length - 1]),
      rightBorder = geom.cellA(lastAttrib, lastLevel) + geom.bandwidthA() + 2,
      ys =
        geom.cellR(idOf(indexOfRow(link.source)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      yt =
        geom.cellR(idOf(indexOfRow(link.target)), lastLevel) +
        geom.bandwidthR(lastLevel) / 2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy - miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy / 6,
      miny + midy / 2, // mid point
      rightBorder,
      maxy // end point
    );
  }
```

Delete the original from `src/navio.js` (currently `:2811-2832`). Update its one
caller inside `drawLinks` (currently `:2849`):
`drawLink(geom, link);` → `canvasRenderer.drawLink(geom, link);`

Add `quadraticCurveTo` to the test's `fakeContext`:

```js
    quadraticCurveTo: (a, b, c, d) =>
      calls.push(["quadraticCurveTo", a, b, c, d]),
```

- [ ] **Step 4: Move `drawLevelConnections`**

Add to `src/render/canvas.js`. Its body is unchanged except that `dataIs`,
`posAt`, `idOf` and `nv` come from `ctx`, and the two `drawLine` calls now
resolve to the module's own private function directly (no `canvasRenderer.`
prefix — it is a sibling inside the same factory):

```js
  function drawLevelConnections(geom, level) {
    if (level <= 0) {
      return;
    }
    const dataIs = ctx.dataIs,
      posAt = ctx.posAt,
      idOf = ctx.idOf,
      nv = ctx.nv;
    for (let item of dataIs[level].representatives) {
      // Compute the yPrev by calculating the index of the corresponding
      // representative
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
      // `points` is built in (attribute-axis, record-axis) space above - the
      // .x fields come from levelScale/xScale and the .y fields from yScales -
      // so mapping the whole path through toXY transposes it for free (#22).
      const path = points.map((pt) => geom.toXY(pt.x, pt.y));
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
    }
  }
```

Delete the original from `src/navio.js` (currently `:2877-2926`). Update its one
caller inside `updateLevel` (currently `:3326`):
`drawLevelConnections(geom, i);` → `canvasRenderer.drawLevelConnections(geom, i);`

- [ ] **Step 5: Widen the module's return**

```js
  return {
    drawItem,
    drawLevelBorder,
    drawLink,
    drawLevelConnections,
    drawLine,
  };
```

- [ ] **Step 6: Confirm nothing was left behind**

```bash
node -e '
const s = require("fs").readFileSync("src/navio.js", "utf8");
for (const n of ["drawItem", "drawLevelBorder", "drawLink", "drawLevelConnections", "drawLine"]) {
  const m = s.match(new RegExp("(^|[^.\\w$])" + n + "\\b", "g")) || [];
  console.log(n, m.length);
}
'
```
Expected: every count is `0`. A non-zero count means either a declaration
survived or a call site still reads the bare name — find it before proceeding.
Note `drawLinks` (plural) still exists in `navio.js` and is a different
function; the `\b` boundary keeps it out of `drawLink`'s count.

- [ ] **Step 7: Full gate**

```bash
npm run check > /tmp/check2.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e2.log 2>&1; echo "EXIT: $?"
```

Both must be `EXIT: 0`. Watch `test/e2e/106-pixel-grid.spec.js` (the #105
half-pixel fix, which `drawItem` carries) and
`test/e2e/61-link-endpoints.spec.js` (which `drawLink` carries) in particular.

- [ ] **Step 8: Commit**

```bash
git add src/render/canvas.js src/navio.js test/unit/canvas-renderer.test.js
git commit -m "Move the four remaining private canvas painters into the module"
```

---

## Task 3: Move the two entry points and narrow the public surface

**Files:**
- Modify: `src/render/canvas.js`
- Modify: `src/navio.js` (delete two functions, update `nv.update`)

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `createCanvasRenderer(ctx)` returns exactly
  `{ updateLevel, drawLinks }`. `updateLevel(geom, levelData, i)`,
  `drawLinks(geom)`. All five painters from Tasks 1-2 become private.

- [ ] **Step 1: Move `updateLevel`**

Add to `src/render/canvas.js`. The three calls it makes are now siblings inside
the same factory, so they lose any prefix:

```js
  function updateLevel(geom, levelData, i) {
    drawLevelBorder(geom, i);
    for (let rep of levelData.representatives) {
      drawItem(geom, rep, i);
    }

    drawLevelConnections(geom, i);
  }
```

Delete the original from `src/navio.js` (currently `:3320-3327`).

- [ ] **Step 2: Move `drawLinks`**

Add to `src/render/canvas.js`:

```js
  function drawLinks(geom) {
    const context = ctx.context,
      links = ctx.links,
      nv = ctx.nv;
    if (!links.length) return;
    if (nv.DEBUG)
      console.log("Draw links ", links[links.length - 1].length, links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(
      1,
      // links.length, not links[last].length - the latter is a link object, so
      // this evaluated to NaN and canvas silently ignored the assignment.
      Math.max(0.1, 1000 / links.length)
    ); // More links more transparency
    for (let link of ctx.visibleLinks) {
      drawLink(geom, link);
    }
    context.stroke();
    context.restore();
  }
```

Delete the original from `src/navio.js` (currently `:2834-2854`).

Add `globalAlpha` to the test's `fakeContext`:

```js
    set globalAlpha(v) {
      calls.push(["globalAlpha", v]);
    },
```

- [ ] **Step 3: Narrow the return**

```js
  return { updateLevel, drawLinks };
```

- [ ] **Step 4: Update `nv.update`'s two call sites**

Currently `src/navio.js:3540` and `:3541`:

```js
    drawLinks(geom);
```
becomes
```js
    canvasRenderer.drawLinks(geom);
```

and

```js
      updateLevel(geom, dataIs[i], i);
```
becomes
```js
      canvasRenderer.updateLevel(geom, dataIs[i], i);
```

- [ ] **Step 5: Confirm the move is complete**

```bash
node -e '
const s = require("fs").readFileSync("src/navio.js", "utf8");
for (const n of ["updateLevel", "drawLinks"]) {
  const m = s.match(new RegExp("(^|[^.\\w$])" + n + "\\b", "g")) || [];
  console.log(n, m.length);
}
console.log("navio.js lines:", s.split("\n").length);
'
```
Expected: both counts `0`. The line count should be roughly 3975 — about 208
lines below the 4183 this plan started from. Report the real number in the
commit message.

- [ ] **Step 6: Full gate**

```bash
npm run check > /tmp/check3.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e3.log 2>&1; echo "EXIT: $?"
```

Both must be `EXIT: 0`, all 293 e2e specs passing.

- [ ] **Step 7: Commit**

```bash
git add src/render/canvas.js src/navio.js test/unit/canvas-renderer.test.js
git commit -m "Move updateLevel and drawLinks; canvas painting now lives in one module"
```

---

## Task 4: Fix #111 and prove the hot path did not regress

Issue [#111](https://github.com/john-guerra/navio/issues/111) recorded a
measured ~7.7-8.5% regression when `geom` turned direct reads into method calls.
Its scoped fix touches `drawItem` and `geometry.js`'s `snapToDevice` — both open
in this plan. `CLAUDE.md`: *measure performance claims; do not reason about
them.*

**Files:**
- Modify: `src/render/canvas.js` (`drawItem`)
- Modify: `src/geometry.js` (`snapToDevice`)

**Interfaces:** unchanged. This task alters no signature.

- [ ] **Step 1: Record the baseline BEFORE changing anything**

Write `/tmp/bench-canvas.cjs` (outside the repo — `CLAUDE.md`: temporary
scripts and probe files belong outside the repo):

```js
const { chromium } = require("@playwright/test");

const PORT = process.env.NAVIO_TEST_PORT || 4190;
const URL = `http://localhost:${PORT}/test/e2e/fixtures/perf.html?n=20000`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.nv && window.nv.getRowsAtLevel);

  const sample = () =>
    page.evaluate(() => {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) window.nv.hardUpdate();
      return performance.now() - t0;
    });

  await sample(); // warmup - discarded, JIT has not settled
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await sample());
  runs.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      runs: runs.map((r) => +r.toFixed(2)),
      median: +runs[2].toFixed(2),
    })
  );
  await browser.close();
})();
```

Start the dev server and take the baseline on the CURRENT commit:

```bash
npm run build > /tmp/bench-build.log 2>&1; echo "BUILD EXIT: $?"
npx http-server -p 4190 -s > /tmp/bench-server.log 2>&1 &
sleep 3
node /tmp/bench-canvas.cjs   # record this as BEFORE
```

`npx http-server -p <port> -s` is what `playwright.config.js:22` uses as its
`webServer.command`; it serves the repo root, which is why the fixture URL above
is a repo-relative path. Kill it when the task is done (`kill %1`, or find it
with `lsof -ti:4190`).

**`CLAUDE.md` landmine:** Playwright's `reuseExistingServer` only checks that
*something* answers on the port, not that it is serving this repo. A dev server
from another project taking 4190 would make the whole benchmark measure the
wrong bundle. Before trusting any number, confirm the server is this repo's:

```bash
curl -s http://localhost:4190/package.json | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const p = JSON.parse(s);
  console.log(p.name === "navio" ? "OK: navio " + p.version : "WRONG SERVER: " + p.name);
});'
```

- [ ] **Step 2: Fix `snapToDevice` in `src/geometry.js`**

Currently `src/geometry.js:123-126` calls `pixelRatio()` twice per invocation,
and `drawItem` calls `snapToDevice` once per attribute per row:

```js
  function snapToDevice(coord, deviceWidth) {
    const dev = Math.round(coord * pixelRatio()) + (deviceWidth % 2 ? 0.5 : 0);
    return dev / pixelRatio();
  }
```
becomes
```js
  function snapToDevice(coord, deviceWidth) {
    // One read, not two: this runs once per (row, attribute) cell, which is
    // navio's hot path (#111).
    const ratio = pixelRatio();
    const dev = Math.round(coord * ratio) + (deviceWidth % 2 ? 0.5 : 0);
    return dev / ratio;
  }
```

Leave the whole doc comment above it untouched — it carries the #105 bug
context and is load-bearing.

- [ ] **Step 3: Hoist `pixelRatio()` in `drawItem`**

In `src/render/canvas.js`'s `drawItem`, add one line after the `geom`
destructuring:

```js
    // pixelRatio is a method call on geom; read it once per row rather than
    // twice per attribute (#111).
    const ratio = pixelRatio();
```

Then replace the two uses inside the attribute loop:

```js
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * pixelRatio())
      );
```
becomes
```js
      const deviceWidth = Math.max(
        1,
        Math.round(Math.ceil(bandwidthR(level)) * ratio)
      );
```

and

```js
      context.lineWidth = deviceWidth / pixelRatio();
```
becomes
```js
      context.lineWidth = deviceWidth / ratio;
```

Do **not** remove `pixelRatio` from the `geom` destructuring — `ratio` is
derived from it.

- [ ] **Step 4: Re-measure, A/B/A**

```bash
npm run build > /tmp/bench-build2.log 2>&1; echo "BUILD EXIT: $?"
node /tmp/bench-canvas.cjs   # AFTER
git stash
npm run build > /dev/null 2>&1
node /tmp/bench-canvas.cjs   # BEFORE again - rules out thermal drift
git stash pop
npm run build > /dev/null 2>&1
node /tmp/bench-canvas.cjs   # AFTER again
```

Report all four medians. **A net regression fails this task** — if the AFTER
medians are worse than both BEFORE medians, stop and report rather than
committing; the fix was supposed to be favourable and a regression means
something else changed.

- [ ] **Step 5: Full gate**

```bash
npm run check > /tmp/check4.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e4.log 2>&1; echo "EXIT: $?"
```

`test/e2e/106-pixel-grid.spec.js` is the one that matters here: it pins #105's
half-pixel fix, and both edits touch that arithmetic. It must pass.

- [ ] **Step 6: Clean up the probe**

```bash
rm -f /tmp/bench-canvas.cjs
git status --porcelain   # must show only the two intended source files
```

- [ ] **Step 7: Commit with the numbers**

```bash
git add src/render/canvas.js src/geometry.js
git commit -m "Hoist pixelRatio out of the per-attribute loop (#111)

Measured with 100 hardUpdate() calls at 20000 rows, medians of 5 runs,
A/B/A ordered with a discarded warmup: <BEFORE1> / <AFTER1> / <BEFORE2> /
<AFTER2> ms."
```

Replace the placeholders with the real measurements. A commit message with
`<BEFORE1>` still in it is a failed task.

---

## Task 5: Document the new layout

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the module to the Layout block**

In `CLAUDE.md`'s Layout block, immediately after the `src/geometry.js` line
added by the previous phase, add:

```
src/render/canvas.js    every function that paints to the 2D context. Built
                    with a ctx of getters like geometry.js; imports nothing.
                    Exposes updateLevel and drawLinks; the five painters
                    behind them are private.
```

- [ ] **Step 2: Correct the `src/navio.js` line count**

```bash
wc -l src/navio.js
```

Update the `src/navio.js        ~4190 lines, ONE closure...` line to the real
current figure, rounded to the nearest 10.

- [ ] **Step 3: Full gate**

```bash
npm run check > /tmp/check5.log 2>&1; echo "EXIT: $?"
```

`test/unit/agent-guide.test.js` validates parts of `CLAUDE.md`; a malformed
Layout block fails it.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document src/render/canvas.js in the layout"
```

---

## Self-Review

**Spec coverage:** §1 (purpose) → plan intro. §2 (why canvas not SVG) → the
scope is canvas-only throughout; no task touches an SVG renderer. §3 (the
module, its two entry points, the exact ctx table) → Task 1 Step 5 builds the
ctx verbatim from the spec's table; Task 3 narrows the return to the two entry
points §3 names. §3.2 (the row-accessor seam is noted, not extracted) → no task
extracts it, as designed. §4 (performance: destructure at entry, fix #111,
mandatory measured benchmark) → Task 2 Step 2's hoisting comment, and Task 4 in
full. §5 (no API change; `drawLine` keeps screen points; do not cache link
endpoints) → Global Constraints, plus the preserved comments in Task 2 Steps 3-4.
§6 (existing e2e is the net; one construction-contract unit test; no new
canvas-pixel assertions) → Task 1's three unit tests are contract-only; every
task gates on the full e2e suite. §7 (five-stage sequencing) → Tasks 1-5, in
that order. §8 (risks) → the hot-path risk is gated by Task 4 Step 4's
fail-condition; the missed-ctx-entry risk by Task 2 Step 6 and Task 3 Step 5's
zero-count checks.

**Placeholder scan:** the only intentional placeholders are the four benchmark
figures in Task 4 Step 7's commit message, which cannot be known before the
benchmark runs — and that step states explicitly that leaving them unreplaced
fails the task. Every other code block is real, taken from `src/navio.js` at
commit `4cb33ac`.

**Type consistency:** `createCanvasRenderer(ctx)` has one signature throughout.
The returned surface widens in Task 2 (five painters) and narrows in Task 3
(`{ updateLevel, drawLinks }`) — deliberate, stated in both tasks' Interfaces
blocks. `geom` is a first parameter in every moved function, matching the
previous phase's convention. `drawLine(points, width, color, close)` keeps its
exact signature from `navio.js`. `ctx` entry names match `navio.js`'s binding
names one-for-one, so the construction block reads as a list of identifiers.

**Known drift risk:** every line number above was read at commit `4cb33ac` and
will shift as tasks land. Each task's verification step greps by identifier
rather than trusting a line number, which is the guard.
