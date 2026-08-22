# Row Access Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move navio's three pure attribute primitives into `src/utils.js` as
plain exports, and collect the stateful row-identity bookkeeping into a new
`src/rows.js` that owns `posByLevel` and `rowIndex`.

**Architecture:** `getAttribName`/`isMissing`/`getAttrib` become importable
leaves, so the three modules that currently receive them through a context can
import them instead. `createRows(ctx)` in a new `src/rows.js` owns the two state
bindings nothing else writes, and is threaded into those contexts as a single
entry. Both steps that touch hot loops are gated on a real benchmark.

**Tech Stack:** ES modules, vitest for the pure logic and the row module,
Playwright for regression and for the benchmark. No new dependencies.

**Spec:** `docs/ai/2026-08-22-navio-row-access-design.md` — read it first,
especially §4.1 (the by-value trap), §6 (why two steps are benchmark-gated),
§8 (sequencing and the TDZ constraint) and §11 (what an earlier draft got
wrong).

## Global Constraints

- **Behaviour-preserving.** No API change, no new option. `src/params.js` and
  `docs/ai/API.md` are untouched by this plan.
- **`getAttrib` is passed BY VALUE into `src/filters.js`** at `navio.js:1698`,
  `:1710`, `:1794`, `:1801`, `:3539`, and `filters.js` calls it with **two**
  arguments. Those sites must receive a bound wrapper, never the bare import,
  or the `debug` argument arrives `undefined` and the log silently dies. No test
  covers `console.log`, so this fails green.
- **`nv.DEBUG` is read at call time, never captured at construction.**
  `CLAUDE.md` states it must work when set after construction.
- **The construction contract:** anything the closure rebinds crosses as a
  getter. For `rows.js` that is `data`, `id`, `selectedFlags`; `nv` is never
  rebound and crosses as a plain value.
- **TDZ:** `const rows = createRows(...)` must appear textually **before**
  `navio.js:1276`, where the canvas context literal is evaluated eagerly.
- **Benchmark-gated steps:** Tasks 3 and 4 both require a real before/after
  measurement. A net regression is a task failure, not a footnote.
- **Gate per task:** `npm run check` **and**
  `NAVIO_TEST_PORT=4190 npx playwright test` must both pass.
- **Check exit codes, never grep output.** A rollup `SyntaxError` prints
  capitalised and does not match a grep for `error`.
- **`grep`/`fgrep` here do not support `\|` alternation**, and `\s` fails in BSD
  sed on macOS. Use `node` with `acorn` for anything structural.
- **Commit each task separately.** Do not batch.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/utils.js` | Gains `getAttribName`, `isMissing`, `getAttrib`. Already the home for attribute-accessor mechanics. Imports nothing. |
| `src/rows.js` | **New.** Row identity and position. Owns `posByLevel` and `rowIndex`. |
| `src/navio.js` | Loses all eight functions; gains two imports and one bound wrapper. |
| `test/unit/utils.test.js` | Extended for the three new exports. |
| `test/unit/rows.test.js` | **New.** The row module including its cache-invalidation contract. |
| `CLAUDE.md` | Layout block. |

---

## Task 1: Move the pure three into `src/utils.js`

**Files:**
- Modify: `src/utils.js`, `src/navio.js`, `src/attribs.js`,
  `src/render/canvas.js`, `src/chrome/settings-panel.js`
- Test: `test/unit/utils.test.js`

**Interfaces:**
- Produces: `getAttribName(attrib)`, `isMissing(v)`,
  `getAttrib(item, attrib, debug)` as named exports of `src/utils.js`.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/utils.test.js` (create the import line if the file does not
already import from `../../src/utils.js`):

```js
describe("getAttribName", () => {
  it("returns a string attribute unchanged", () => {
    expect(getAttribName("value")).toBe("value");
  });
  it("returns a named function's name", () => {
    const f = function score(d) {
      return d.a;
    };
    expect(getAttribName(f)).toBe("score");
  });
  it("returns the function itself when it is anonymous", () => {
    const f = (d) => d.a;
    Object.defineProperty(f, "name", { value: "" });
    expect(getAttribName(f)).toBe(f);
  });
});

describe("isMissing", () => {
  it.each([undefined, null, "", "none"])("treats %p as missing", (v) => {
    expect(isMissing(v)).toBe(true);
  });
  it.each([0, false, "a", NaN])("treats %p as present", (v) => {
    expect(isMissing(v)).toBe(false);
  });
});

describe("getAttrib", () => {
  it("reads a plain property", () => {
    expect(getAttrib({ a: 1 }, "a")).toBe(1);
  });
  it("calls a function accessor", () => {
    expect(getAttrib({ a: 1 }, (d) => d.a * 2)).toBe(2);
  });

  // The accessor is caller-supplied, so it can throw on rows it does not
  // expect. Navio swallows that and renders the cell as missing rather than
  // aborting the whole redraw.
  it("returns undefined when the accessor throws, and stays silent", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const boom = () => {
      throw new Error("nope");
    };
    expect(getAttrib({}, boom)).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs when debug is true", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const boom = () => {
      throw new Error("nope");
    };
    expect(getAttrib({}, boom, true)).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

Ensure `vi` is imported from `vitest` in that file's import line alongside
`describe`/`it`/`expect`.

- [ ] **Step 2: Run and confirm they fail**

```bash
npx vitest run test/unit/utils.test.js
```
Expected: FAIL — the three names are not exported.

- [ ] **Step 3: Add the three exports to `src/utils.js`**

Append to `src/utils.js`:

```js
/** The display name of an attribute: a string is its own name, a function's
 * name is its `name`, and an anonymous function is its own name. */
export function getAttribName(attrib) {
  if (typeof attrib === "function") {
    return attrib.name ? attrib.name : attrib;
  } else {
    return attrib;
  }
}

/** Values navio renders as the null colour rather than through a scale. */
export function isMissing(v) {
  return v === undefined || v === null || v === "" || v === "none";
}

/**
 * Read `attrib` off `item`, whether it is a property name or an accessor
 * function.
 *
 * A function accessor is caller-supplied and can throw on a row it does not
 * expect; navio swallows that and treats the cell as missing rather than
 * aborting the redraw. `debug` is passed explicitly rather than read off `nv`
 * because this is a pure leaf - callers pass `nv.DEBUG`, and must read it AT
 * CALL TIME, since CLAUDE.md requires `nv.DEBUG = true` to work after
 * construction.
 */
export function getAttrib(item, attrib, debug) {
  if (typeof attrib === "function") {
    try {
      return attrib(item);
    } catch (e) {
      if (debug)
        console.log(
          "navio error getting attrib with item ",
          item,
          " attrib ",
          attrib,
          "error",
          e
        );
      return undefined;
    }
  } else {
    return item[attrib];
  }
}
```

- [ ] **Step 4: Run and confirm they pass**

```bash
npx vitest run test/unit/utils.test.js
```

- [ ] **Step 5: Delete the three from `navio.js` and import them**

Delete `getAttribName` (currently `:1357-1363`), `isMissing` (`:2863-2865`) and
`getAttrib` (`:1336-1355`) from `src/navio.js`.

Add to the existing import of `./utils.js` at the top of `src/navio.js` (there
is already one — extend its named list rather than adding a second import):

```js
import { getAttrib, getAttribName, isMissing } from "./utils.js";
```

- [ ] **Step 6: Fix every `getAttrib` call site in `navio.js`**

Direct calls gain `nv.DEBUG` as a third argument. Find them with:

```bash
node -e '
const s = require("fs").readFileSync("src/navio.js", "utf8");
const re = /(^|[^.\w$])getAttrib\s*\(/g;
let m, out = [];
while ((m = re.exec(s))) out.push(s.slice(0, m.index).split("\n").length);
console.log("direct getAttrib( call lines:", out.join(", "));
'
```

Each becomes `getAttrib(item, attrib, nv.DEBUG)`.

**The by-value sites are different and are the trap in this task.**
`src/filters.js` calls `getAttrib` with two arguments, so it must not receive
the bare import. Add this near the other closure helpers, before the first
filter construction:

```js
  // filters.js calls getAttrib with two arguments, so it cannot receive the
  // bare import - the debug flag would arrive undefined and the log would die
  // silently, with nothing testing console output to catch it. nv.DEBUG is
  // read INSIDE the wrapper so a runtime toggle still works (CLAUDE.md).
  const getAttribForFilters = (d, a) => getAttrib(d, a, nv.DEBUG);
```

Replace the shorthand `getAttrib,` with `getAttrib: getAttribForFilters,` at
each of the five filter-factory option objects: `navio.js:1698`, `:1710`,
`:1794`, `:1801`, `:3539`. Verify by reading each site — they are all inside an
options literal passed to a `FilterBy*` constructor or to `filterFromValue`.

- [ ] **Step 7: Drop the entries from the three module contexts**

In `src/navio.js`, remove `getAttrib` and `getAttribName` from the canvas
context literal (around `:1300`) and from the attribs context literal (around
`:3399`), and remove `getAttribName` from the settings-panel context (around
`:1224`). Then in each module, import instead:

- `src/render/canvas.js` — add `import { getAttrib, getAttribName, isMissing } from "../utils.js";` (note `../`, it is one directory down) and replace `ctx.getAttrib`, `ctx.getAttribName`, `ctx.isMissing` with the imports. `drawItem` currently hoists them from `ctx` at entry; hoist the imports the same way or use them directly — they are module-level constants now, so either is correct.
- `src/attribs.js` — add `import { getAttrib, getAttribName } from "./utils.js";` and replace `ctx.getAttrib` / `ctx.getAttribName`. **`ctx.getAttrib` calls here must gain `ctx.nv.DEBUG`** as their third argument.
- `src/chrome/settings-panel.js` — add `import { getAttribName } from "../utils.js";` and replace `ctx.getAttribName`. Note `:93` passes `getAttribName: ctx.getAttribName` into a nested object; that becomes `getAttribName` (the import).

- [ ] **Step 8: Confirm nothing still reaches for them through a context**

```bash
node -e '
const fs = require("fs");
for (const f of ["src/attribs.js","src/render/canvas.js","src/chrome/settings-panel.js","src/navio.js"]) {
  const s = fs.readFileSync(f, "utf8");
  for (const n of ["getAttribName","isMissing","getAttrib"]) {
    const c = (s.match(new RegExp("ctx\\." + n + "\\b", "g")) || []).length;
    if (c) console.log(f, "still uses ctx." + n, c, "times");
  }
}
console.log("scan done");
'
```
Expected: only `scan done`.

- [ ] **Step 9: Full gate**

```bash
npm run check > /tmp/check1.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e1.log 2>&1; echo "EXIT: $?"
```

Both `EXIT: 0`. The filter specs matter most here — anything under
`test/e2e/` exercising brushing or select-by-value goes through `filters.js`.

- [ ] **Step 10: Commit**

```bash
git add src/utils.js src/navio.js src/attribs.js src/render/canvas.js src/chrome/settings-panel.js test/unit/utils.test.js
git commit -m "Move the pure attribute primitives into utils.js"
```

---

## Task 2: Build `src/rows.js`

**Files:**
- Create: `src/rows.js`, `test/unit/rows.test.js`
- Modify: `src/navio.js`

**Interfaces:**
- Consumes: `getAttrib` from `src/utils.js` (Task 1).
- Produces: `createRows(ctx)` returning `{ idOf, attribAt, posAt, indexOfRow,
  idFromRow, assignIndexes, initForData, clear }`. Context is
  `{ nv, get data(), get id(), get selectedFlags() }`.

- [ ] **Step 1: Write the failing tests**

Create `test/unit/rows.test.js`:

```js
import { describe, it, expect } from "vitest";
import { createRows } from "../../src/rows.js";

function buildCtx(overrides = {}) {
  return {
    nv: { DEBUG: false },
    data: [],
    id: "__seqId",
    selectedFlags: new Uint8Array(0),
    ...overrides,
  };
}

describe("idOf", () => {
  it("is the index itself under the default __seqId id", () => {
    const rows = createRows(buildCtx({ data: [{ k: "a" }, { k: "b" }] }));
    expect(rows.idOf(1)).toBe(1);
  });
  it("reads the configured id off the row otherwise", () => {
    const rows = createRows(
      buildCtx({ data: [{ k: "a" }, { k: "b" }], id: "k" })
    );
    expect(rows.idOf(1)).toBe("b");
  });
});

describe("attribAt", () => {
  const ctx = () =>
    buildCtx({
      data: [{ v: 10 }, { v: 20 }],
      selectedFlags: Uint8Array.from([0, 1]),
    });

  it("resolves __seqId to the index", () => {
    expect(createRows(ctx()).attribAt(1, "__seqId")).toBe(1);
  });
  // `selected` is a rendered column backed by a side table, not a row
  // property - reading it off the row gives undefined, which is how a
  // serialized brush once silently failed to rebuild (#88).
  it("resolves selected from the side table as a boolean", () => {
    const rows = createRows(ctx());
    expect(rows.attribAt(1, "selected")).toBe(true);
    expect(rows.attribAt(0, "selected")).toBe(false);
  });
  it("reads a real attribute off the row", () => {
    expect(createRows(ctx()).attribAt(0, "v")).toBe(10);
  });
});

describe("indexOfRow", () => {
  it("passes a number straight through", () => {
    expect(createRows(buildCtx()).indexOfRow(3)).toBe(3);
  });
  it("returns undefined for a non-object", () => {
    expect(createRows(buildCtx()).indexOfRow("x")).toBeUndefined();
  });
  it("finds a row object by identity", () => {
    const a = { v: 1 },
      b = { v: 2 };
    const rows = createRows(buildCtx({ data: [a, b] }));
    expect(rows.indexOfRow(b)).toBe(1);
  });

  // The lazy WeakMap is built once over `data`. If it is not dropped when data
  // is replaced, every lookup after nv.data() resolves against the old rows.
  it("invalidates its cache when the data is replaced", () => {
    const a = { v: 1 };
    let data = [a];
    const ctx = buildCtx();
    Object.defineProperty(ctx, "data", { get: () => data });
    const rows = createRows(ctx);
    expect(rows.indexOfRow(a)).toBe(0);

    const b = { v: 2 };
    data = [b, a];
    rows.initForData();
    expect(rows.indexOfRow(a)).toBe(1);
    expect(rows.indexOfRow(b)).toBe(0);
  });
});

describe("idFromRow", () => {
  it("uses object identity under the default id", () => {
    const a = { v: 1 },
      b = { v: 2 };
    const rows = createRows(buildCtx({ data: [a, b] }));
    expect(rows.idFromRow(b)).toBe(1);
  });
  it("reads the configured id off a foreign object", () => {
    const rows = createRows(buildCtx({ data: [], id: "k" }));
    expect(rows.idFromRow({ k: "z" })).toBe("z");
  });
});

describe("assignIndexes / posAt", () => {
  it("round-trips a level's positions", () => {
    const rows = createRows(buildCtx({ data: [{}, {}, {}] }));
    rows.initForData();
    rows.assignIndexes([2, 0, 1], 1);
    expect(rows.posAt(2, 1)).toBe(0);
    expect(rows.posAt(0, 1)).toBe(1);
    expect(rows.posAt(1, 1)).toBe(2);
  });
  it("returns undefined for a level that has none", () => {
    expect(createRows(buildCtx()).posAt(0, 7)).toBeUndefined();
  });
});

describe("initForData / clear", () => {
  it("initForData seeds level 0 as identity over the data", () => {
    const rows = createRows(buildCtx({ data: [{}, {}, {}] }));
    rows.initForData();
    expect(rows.posAt(0, 0)).toBe(0);
    expect(rows.posAt(2, 0)).toBe(2);
  });
  it("clear drops every level", () => {
    const rows = createRows(buildCtx({ data: [{}, {}] }));
    rows.initForData();
    rows.clear();
    expect(rows.posAt(0, 0)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

```bash
npx vitest run test/unit/rows.test.js
```
Expected: FAIL — `src/rows.js` does not exist.

- [ ] **Step 3: Create `src/rows.js`**

```js
import { getAttrib } from "./utils.js";

/**
 * Row identity and position.
 *
 * Owns `posByLevel` and `rowIndex` outright: an AST scan of src/navio.js found
 * no writer of either outside this group and the two lifecycle sites, so they
 * move in rather than being passed in. `selectedFlags` is the opposite case -
 * applyFilters and deleteSubsequentLevels write it - so it stays a read.
 *
 * `data`, `id` and `selectedFlags` all cross as GETTERS: each is reassigned on
 * nv.data() and nv.destroy(), and `id` also by nv.id(). CLAUDE.md's "a module
 * gets GETTERS, not values" landmine is about exactly this. `nv` is never
 * rebound and is a plain value.
 *
 * Neither `data`, `id` nor `selectedFlags` is pinned end-to-end by a test:
 * the unit tests here build their own ctx, which proves this module re-reads
 * but says nothing about navio.js supplying getters. Verify by hand if you
 * change how they are supplied.
 *
 * See docs/ai/2026-08-22-navio-row-access-design.md.
 *
 * @param {object} ctx - { nv, get data(), get id(), get selectedFlags() }
 */
export function createRows(ctx) {
  // One Int32Array per level, allocated on first use, rather than an array
  // object hanging off every row. See #88.
  let posByLevel = [];
  // Lazy identity index over `data`, built on first object lookup and dropped
  // whenever the data is replaced.
  let rowIndex = null;

  function idOf(index) {
    return ctx.id === "__seqId"
      ? index
      : getAttrib(ctx.data[index], ctx.id, ctx.nv.DEBUG);
  }

  function attribAt(index, attrib) {
    if (attrib === "__seqId") return index;
    // Also a drawn column backed by a side table, so it needs resolving here
    // for the same reason - otherwise sorting by it compares undefined to
    // undefined and does nothing.
    if (attrib === "selected") return !!ctx.selectedFlags[index];
    return getAttrib(ctx.data[index], attrib, ctx.nv.DEBUG);
  }

  function posAt(index, level) {
    const p = posByLevel[level];
    return p ? p[index] : undefined;
  }

  function indexOfRow(rowOrIndex) {
    if (typeof rowOrIndex === "number") return rowOrIndex;
    if (!rowOrIndex || typeof rowOrIndex !== "object") return undefined;
    if (!rowIndex) {
      rowIndex = new WeakMap();
      const data = ctx.data;
      for (let i = 0; i < data.length; i++) rowIndex.set(data[i], i);
    }
    return rowIndex.get(rowOrIndex);
  }

  /**
   * The identity value of a row, however this instance identifies rows.
   *
   * A custom id lives on the row, so a foreign object resolves fine. The
   * default id is the row's index into `data`, which only an object we own
   * can supply - hence the identity lookup.
   */
  function idFromRow(row) {
    return ctx.id !== "__seqId"
      ? getAttrib(row, ctx.id, ctx.nv.DEBUG)
      : indexOfRow(row);
  }

  function assignIndexes(dataIsToUpdate, level) {
    if (ctx.nv.DEBUG) console.log("Assigning indexes ", level);
    if (!posByLevel[level])
      posByLevel[level] = new Int32Array(ctx.data.length);
    for (let j = 0; j < dataIsToUpdate.length; j++) {
      posByLevel[level][dataIsToUpdate[j]] = j;
    }
  }

  /** Seed level 0 as the identity over the current data. Call AFTER `data`
   * has been reassigned - it reads the new length. */
  function initForData() {
    posByLevel = [
      Int32Array.from({ length: ctx.data.length }, (_unused, i) => i),
    ];
    rowIndex = null;
  }

  /** Drop everything. Teardown only. */
  function clear() {
    posByLevel = [];
    rowIndex = null;
  }

  return {
    idOf,
    attribAt,
    posAt,
    indexOfRow,
    idFromRow,
    assignIndexes,
    initForData,
    clear,
  };
}
```

- [ ] **Step 4: Run and confirm they pass**

```bash
npx vitest run test/unit/rows.test.js
```

- [ ] **Step 5: Construct it in `navio.js`, before line 1276**

Delete `idOf` (`:1179`), `attribAt` (`:1193`), `posAt` (`:1321`),
`indexOfRow` (`:1326`), `assignIndexes` (`:1386`) and the `posByLevel` /
`rowIndex` entries in the top-of-closure `let` chain (`:145-146`).

Add the import at the top:

```js
import { createRows } from "./rows.js";
```

Construct it around `navio.js:1150` — **before** the canvas context literal at
`:1276`, which is evaluated eagerly and would hit the temporal dead zone
otherwise:

```js
  // Row identity and position. Constructed here rather than lower down
  // because the canvas context literal below reads `rows` eagerly, and a const
  // is in its temporal dead zone until this line runs. The five functions this
  // replaces were hoisted declarations, which is why nothing warns you.
  const rows = createRows({
    nv,
    get data() {
      return data;
    },
    get id() {
      return id;
    },
    get selectedFlags() {
      return selectedFlags;
    },
  });
```

- [ ] **Step 6: Point every caller at it**

Replace bare calls throughout `navio.js`: `idOf(` → `rows.idOf(`, `attribAt(` →
`rows.attribAt(`, `posAt(` → `rows.posAt(`, `indexOfRow(` → `rows.indexOfRow(`,
`assignIndexes(` → `rows.assignIndexes(`.

Replace the two lifecycle sites:
- `navio.js:3432-3435` (inside `nv.data()`), which assigns `posByLevel = [...]`
  and `rowIndex = null`, becomes `rows.initForData();` — placed **after** `data`
  is reassigned.
- `navio.js:3913-3914` (inside `nv.destroy()`) becomes `rows.clear();`.

Replace the open-coded resolution in `nv.setSelectedRows` (`:3666`):

```js
      const v = id !== "__seqId" ? getAttrib(r, id) : indexOfRow(r);
```
becomes
```js
      const v = rows.idFromRow(r);
```

The five filter option objects that pass `getPos: posAt`, `getAttribAt:
attribAt`, `getId: idOf` by value (`:1698`, `:1710`, `:1794`, `:1801`, `:3539`)
must pass the module's versions: `getPos: rows.posAt`, `getAttribAt:
rows.attribAt`, `getId: rows.idOf`. These are plain references, safe to pass
directly — they close over `ctx`, not over `this`.

- [ ] **Step 7: Confirm nothing was left behind**

```bash
node -e '
const s = require("fs").readFileSync("src/navio.js", "utf8");
for (const n of ["idOf","attribAt","posAt","indexOfRow","assignIndexes","posByLevel","rowIndex"]) {
  const c = (s.match(new RegExp("(^|[^.\\w$])" + n + "\\b", "g")) || []).length;
  console.log(n.padEnd(14), c);
}
'
```
Expected: every count `0`.

- [ ] **Step 8: Full gate**

```bash
npm run check > /tmp/check2.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e2.log 2>&1; echo "EXIT: $?"
```

Both `EXIT: 0`. `test/e2e/88-no-row-mutation.spec.js` and any sort or brush
spec are the ones that would catch a bad move here.

- [ ] **Step 9: Commit**

```bash
git add src/rows.js test/unit/rows.test.js src/navio.js
git commit -m "Collect row identity and position into src/rows.js"
```

---

## Task 3: Thread `rows` through the module contexts, and measure

**Files:**
- Modify: `src/navio.js`, `src/render/canvas.js`, `src/attribs.js`,
  `test/unit/canvas-renderer.test.js`

**Interfaces:**
- Consumes: `rows` from Task 2.
- Produces: `canvas.js` and `attribs.js` receive `rows` as a single context
  entry instead of the individual functions.

Per the spec's §6 this is the step where a regression would start: `idOf` runs
twice per attribute per row inside `drawItem`, and `attribAt` is the sort
comparator at O(n log n). Unlike the canvas phase, the callee cannot hoist.

- [ ] **Step 1: Record the baseline BEFORE changing anything**

Write `/tmp/bench-rows.cjs` (outside the repo — temporary probes do not belong
in it):

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
  await sample(); // warmup, discarded
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

```bash
npm run build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
npx http-server -p 4190 -s > /tmp/server.log 2>&1 &
sleep 3
curl -s http://localhost:4190/package.json | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const p=JSON.parse(s);
  console.log(p.name === "navio" ? "OK: navio " + p.version : "WRONG SERVER: " + p.name);
});'
node /tmp/bench-rows.cjs   # BEFORE
```

The `curl` check is not optional: Playwright's `reuseExistingServer` only
verifies that *something* answers on the port, and a sibling project's server
would silently benchmark the wrong bundle.

- [ ] **Step 2: Thread `rows` into the canvas context**

In `src/navio.js`'s canvas context literal, remove `idOf`, `indexOfRow` and
`posAt`, and add `rows,` (a plain value — `rows` is a `const`, never rebound).

In `src/render/canvas.js`, replace `ctx.idOf` → `ctx.rows.idOf`,
`ctx.indexOfRow` → `ctx.rows.indexOfRow`, `ctx.posAt` → `ctx.rows.posAt`. Keep
the existing entry-hoisting convention: where the file already hoists
`idOf = ctx.idOf` at function entry, hoist `idOf = ctx.rows.idOf` instead.

Update the header's context `@param` line and the paragraph naming which
entries are pinned by what, so it stays accurate.

- [ ] **Step 3: Thread `rows` into the attribs context**

In `src/navio.js`'s attribs context literal, remove `attribAt` and add `rows,`.
In `src/attribs.js`, replace `ctx.attribAt` with `ctx.rows.attribAt`.

- [ ] **Step 4: Update the canvas unit test's fake context**

`test/unit/canvas-renderer.test.js`'s `buildCtx` supplies `idOf` and
`indexOfRow` directly. Replace those two entries with:

```js
    rows: {
      idOf: (i) => i,
      indexOfRow: (r) => r,
      posAt: () => 0,
    },
```

and delete the now-unused `idOf` / `indexOfRow` / `posAt` entries.

- [ ] **Step 5: Re-measure, A/B/A**

```bash
npm run build > /tmp/b2.log 2>&1; echo "BUILD EXIT: $?"
node /tmp/bench-rows.cjs   # AFTER
git stash
npm run build > /dev/null 2>&1
node /tmp/bench-rows.cjs   # BEFORE again - rules out drift
git stash pop
npm run build > /dev/null 2>&1
node /tmp/bench-rows.cjs   # AFTER again
```

Report all four medians. **A net regression fails this task.** If both AFTER
medians are worse than both BEFORE medians, STOP and report rather than
committing — the spec's §6 names a fallback (a push model, `setData`/`setId`
instead of getters) that is only to be taken on this measurement, and the
decision to take it is the controller's, not the implementer's.

If the four numbers are within same-code drift of each other, say so plainly
rather than reporting a difference you do not believe.

- [ ] **Step 6: Clean up the probe and gate**

```bash
rm -f /tmp/bench-rows.cjs
kill %1 2>/dev/null
npm run check > /tmp/check3.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e3.log 2>&1; echo "EXIT: $?"
git status --porcelain   # only the four intended files
```

- [ ] **Step 7: Commit with the numbers**

```bash
git add src/navio.js src/render/canvas.js src/attribs.js test/unit/canvas-renderer.test.js
git commit -m "Thread rows through the module contexts

Measured with 100 hardUpdate() calls at 20000 rows, medians of 5, A/B/A
ordered with a discarded warmup: <B1> / <A1> / <B2> / <A2> ms."
```

Replace the four placeholders with real measurements. A commit message still
containing an angle bracket is a failed task.

---

## Task 4: Consolidate `drawItem` onto `rows.attribAt`, or document why not

**Files:**
- Modify: `src/render/canvas.js`, `src/navio.js` (context only)

`drawItem` duplicates `attribAt`'s three-way branch line for line. Consolidating
also drops `data`, `selectedFlags` and `getAttrib` from the canvas context,
since they appear there only inside `drawItem`.

- [ ] **Step 1: Baseline**

Recreate `/tmp/bench-rows.cjs` exactly as in Task 3 Step 1, with the same server
check, and record a BEFORE median.

- [ ] **Step 2: Make the change**

In `src/render/canvas.js`'s `drawItem`, replace:

```js
      const val =
        attrib === "selected"
          ? !!selectedFlags[rowIdx]
          : attrib === "__seqId"
            ? rowIdx
            : getAttrib(item, attrib, nv.DEBUG);
```
with
```js
      const val = attribAt(rowIdx, attrib);
```

hoisting `attribAt = ctx.rows.attribAt` with the other entry reads, and remove
the now-unused `item`, `data`, `selectedFlags` and `getAttrib` reads from that
function. Then remove `data` and `selectedFlags` from the canvas context literal
in `navio.js` and from the unit test's `buildCtx`.

- [ ] **Step 3: Measure, A/B/A, and decide**

Same procedure as Task 3 Step 5.

**If neutral or favourable:** keep the change, commit with the numbers.

**If it regresses:** `git checkout src/render/canvas.js src/navio.js` to revert
the consolidation, and instead add this comment above `drawItem`'s branch,
filling in the real numbers:

```js
      // This is attribAt(rowIdx, attrib) (src/rows.js) open-coded. The
      // duplication is deliberate: consolidating measured <X>ms against
      // <Y>ms on 100 hardUpdate() calls at 20000 rows, because this runs once
      // per cell and a cross-module call per cell is what #111 was about.
      // Keep the two in sync by hand; rows.attribAt is the definition.
```

Either outcome is a passing task. Report which one happened and why.

- [ ] **Step 4: Gate and commit**

```bash
npm run check > /tmp/check4.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e4.log 2>&1; echo "EXIT: $?"
rm -f /tmp/bench-rows.cjs
```

Commit with a message stating the measurement and the decision it drove.

---

## Task 5: Document the new layout

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `src/rows.js` to the Layout block**

After the `src/render/canvas.js` entry, matching the block's existing column
alignment:

```
src/rows.js         row identity and position. Owns posByLevel and rowIndex;
                    reads data/id/selectedFlags through getters. attribAt is
                    the definition of how a cell's value is resolved.
```

Also extend the `src/utils.js` line (or add one if absent) to mention that
`getAttrib`, `getAttribName` and `isMissing` now live there.

- [ ] **Step 2: Correct the line count**

```bash
wc -l src/navio.js
```

Update `src/navio.js        ~4000 lines, ONE closure...` to the real figure,
rounded to the nearest 10. Use `wc -l`, not a `node` script doing
`split("\n").length` — that counts the empty string after the trailing newline
and overstates by one.

- [ ] **Step 3: Gate**

```bash
npm run check > /tmp/check5.log 2>&1; echo "EXIT: $?"
```

`test/unit/agent-guide.test.js` validates `CLAUDE.md`; a malformed Layout block
fails the gate.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document src/rows.js and the utils.js additions in the layout"
```

---

## Self-Review

**Spec coverage:** §1 → plan intro. §2's four groups → Task 1 (pure) and Task 2
(row identity); the two deferred groups are touched by no task, as designed.
§3 → Task 2's module header carries the ownership argument. §4.1 including the
by-value trap → Task 1 Steps 6-7 and Global Constraints. §4.2 including
`idFromRow` and the `initForData`/`clear` split → Task 2 Steps 3, 5, 6. §4.3 →
Tasks 1 and 3. §5 → Task 4. §6's two gates → Task 3 Step 5 and Task 4 Step 3,
both with the stated fallback. §7's invariants → Global Constraints and Task 2's
test list. §8's sequencing and TDZ constraint → task order and Task 2 Step 5.
§9 → Task 1 Step 1 and Task 2 Step 1. §10 → the gates.

**Placeholder scan:** the only intentional placeholders are the benchmark
figures in Task 3 Step 7 and Task 4 Step 3, which cannot be known before the
benchmark runs; both steps state that leaving them unfilled fails the task.
Every other code block is real, read from `src/navio.js` at commit `0b285f7`.

**Type consistency:** `createRows(ctx)` has one signature throughout. The
returned surface is the same eight names in Task 2's Interfaces block, its
implementation, and Tasks 3-4's usage. `getAttrib(item, attrib, debug)` is
three-arity everywhere after Task 1, including the `filters.js` wrapper.
`rows` is a plain context entry (never a getter) because it is a `const`.

**Known drift risk:** every line number was read at `0b285f7` and will shift as
tasks land. Each task verifies by identifier, not by line number.
