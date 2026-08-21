# #67 First Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the theme, the settings storage and the settings panel out of
`src/navio.js` (lines 1249–2841) into three modules, without changing any
behaviour, establishing a mechanism the remaining #67 extractions can reuse.

**Architecture:** Each module is a factory taking an injected context object.
Every non-`const` closure binding crosses as a **getter**, so the module reads
the live binding rather than a value captured at construction. The import graph
is kept acyclic by making `theme.js` a leaf (it does not touch panel elements —
`applyTheme` stays in the panel) and by having the panel construct the storage
module with callbacks rather than the two importing each other.

**Tech Stack:** ES modules, rollup (d3 and popper.js are `external`), vitest for
pure logic, Playwright for everything involving the DOM or canvas.

**Spec:** `docs/ai/2026-08-20-navio-decomposition-design.md` — read it first,
especially §5 (mechanism) and §11 (what the draft got wrong).

## Global Constraints

- **Behaviour-preserving.** No behaviour change, no API change, no new option.
  If a user can see a difference, the task has failed.
- **The context rule:** only `nv` and `instanceId` cross as plain properties.
  Every other closure binding crosses as a getter. `height` and
  `hiddenAttribs` need a setter as well.
- **Construction point:** the factories are constructed at ~line 1249, where
  the slice used to be. Never hoisted above `src/navio.js:336`
  (`OPTION_NAMES = new Set(Object.keys(nv))`) or above `OPTION_ACCESSORS`
  (1274, `const`, TDZ).
- **Gate per task:** `npm run check` **and** `NAVIO_TEST_PORT=4190 npx playwright test`
  must both pass before the next task begins. `npm run check` does not run e2e.
- **Check exit codes, never grep output.** `npm run check > /tmp/x.log 2>&1; echo "EXIT: $?"`
- **Do not commit `dist/`.** It is gitignored and built by the Pages workflow.
- **`collapsedSections` lives in `settings-panel.js`** (decided 2026-08-20);
  storage reaches it through injected `getCollapsed`/`setCollapsed`.
- Commit each task separately. Do not batch.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/theme.js` (new) | Resolve which theme applies and what its colours are. Leaf: imports only `d3`. Knows nothing about the panel. |
| `src/settings-storage.js` (new) | Serialise settings to/from an object and to/from `localStorage`. Knows nothing about how the panel is drawn; receives callbacks. |
| `src/settings-panel.js` (new) | Build, draw, position and dismiss the panel. Composition root for the slice: imports the other two. |
| `src/navio.js` (modify) | Constructs one `createSettingsPanel(ctx)` at ~1249 and calls through it. |
| `test/unit/theme.test.js` (new) | Pure-logic tests for theme resolution. |
| `test/e2e/67-extraction.spec.js` (new) | The stale-`selection` binding test, then deleted or kept per Task 4. |

---

## Task 1: Extract `src/theme.js`

The safest of the three: 134 lines, no sibling imports, and it makes the
`selection`-getter hazard concrete and testable before any panel code moves.

**Files:**
- Create: `src/theme.js`
- Create: `test/unit/theme.test.js`
- Modify: `src/navio.js` — remove 1804–1937, add import and construction

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```js
  export const THEMES;                    // { light: {...}, dark: {...} }
  export function createTheme(ctx);       // ctx: { nv, get selection() }
  // returns { theme, resolvedTheme, divisionsColour, tooltipBackground, backgroundBehind }
  ```
  `theme()` returns the colour table for the resolved theme.
  `resolvedTheme()` returns the string `"light"` or `"dark"`.

- [ ] **Step 1: Write the failing unit test**

`theme.js` is the one part of this slice with pure logic worth a vitest test —
theme resolution is a decision tree over `nv.theme`, the background colour and
`color-scheme`, and it currently has no unit test at all.

Create `test/unit/theme.test.js`:

```js
import { describe, it, expect } from "vitest";
import { createTheme, THEMES } from "../../src/theme.js";

// A context whose `selection` is a getter, so the test can rebind it the way
// init() does at src/navio.js:710-713.
function ctxWith(nv, node) {
  let selection = node ? { node: () => node } : null;
  return {
    ctx: {
      nv,
      get selection() {
        return selection;
      },
    },
    rebind(next) {
      selection = next ? { node: () => next } : null;
    },
  };
}

describe("resolvedTheme", () => {
  it("returns an explicit theme without consulting anything else", () => {
    const { ctx } = ctxWith({ theme: "dark" }, null);
    expect(createTheme(ctx).resolvedTheme()).toBe("dark");
  });

  it("falls back to light when nothing paints a background", () => {
    const { ctx } = ctxWith({ theme: "auto" }, null);
    expect(createTheme(ctx).resolvedTheme()).toBe("light");
  });
});

describe("divisionsColour", () => {
  it("follows the theme when the option is the null sentinel", () => {
    const { ctx } = ctxWith({ theme: "light", divisionsColor: null }, null);
    expect(createTheme(ctx).divisionsColour()).toBe(THEMES.light.divisions);
  });

  it("uses a colour the caller set, in either theme", () => {
    const { ctx } = ctxWith({ theme: "dark", divisionsColor: "#ff0000" }, null);
    expect(createTheme(ctx).divisionsColour()).toBe("#ff0000");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run test/unit/theme.test.js
```

Expected: FAIL — `Failed to resolve import "../../src/theme.js"`.

- [ ] **Step 3: Create `src/theme.js`**

Move `src/navio.js:1804-1937` **verbatim** into the factory body. Do not retype
it; copy the lines, including every comment — they record decisions (why "auto"
means "match what is behind me" rather than following `prefers-color-scheme`)
that must not be lost.

```js
import * as d3 from "d3";

export const THEMES = {
  /* lines 1805-1827 of src/navio.js, verbatim */
};

/**
 * Theme resolution for one Navio instance.
 *
 * `ctx.selection` MUST be a getter. init() rebinds the closure's `selection`
 * from the caller's string to a d3 selection (src/navio.js:710-713), and
 * backgroundBehind walks up from its node - a value captured at construction
 * would still be the string.
 */
export function createTheme(ctx) {
  function backgroundBehind() { /* 1843-1853 verbatim, `selection` -> `ctx.selection` */ }
  function resolvedTheme()    { /* 1870-1885 body, `nv.` -> `ctx.nv.` */ }
  function theme()            { return THEMES[resolvedTheme()] || THEMES.light; }
  function divisionsColour()  { /* 1898-1902, `nv.` -> `ctx.nv.` */ }
  function tooltipBackground(){ /* 1903-1907, `nv.` -> `ctx.nv.` */ }
  return { theme, resolvedTheme, divisionsColour, tooltipBackground, backgroundBehind };
}
```

Two required changes while moving:
1. `selection` → `ctx.selection` (2 sites in `backgroundBehind`).
2. `nv.` → `ctx.nv.` inside the moved bodies.

`nv.resolvedTheme` was a **public method** assigned at 1870. It must stay public
and stay in `PARAMS`, so it is re-registered in Step 5 — not dropped.

- [ ] **Step 4: Run the unit test and confirm it passes**

```bash
npx vitest run test/unit/theme.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into `src/navio.js`**

Delete 1804–1937. At the point where the slice begins (~1249, before
`OPTION_ACCESSORS` at 1274 which calls `toggleSettings`), add:

```js
const _theme = createTheme({
  nv,
  get selection() {
    return selection;
  },
});
const { theme, divisionsColour, tooltipBackground } = _theme;
nv.resolvedTheme = _theme.resolvedTheme;
```

Destructuring keeps all 7 outside call sites (`theme()` at 516, 635, 918, 919,
3004, 3613, 4002; `divisionsColour()` at 2988; `tooltipBackground()` at 513)
working unchanged. Add the import at the top of the file beside the others.

`applyTheme` (1918–1937) **stays in `navio.js`** for now — it touches
`settingsButton`, `settingsPanel` and `tooltipElement`, and it moves to
`settings-panel.js` in Task 3. Leaving it here is what keeps this task acyclic.

- [ ] **Step 6: Verify `resolvedTheme` is still a described option**

```bash
npm run docs:api && git diff --stat docs/ai/API.md
```

Expected: no diff. Then confirm the e2e API gate:

```bash
NAVIO_TEST_PORT=4190 npx playwright test test/e2e/104-describe.spec.js
```

Expected: PASS. A failure here means `nv.resolvedTheme` was dropped or is now
being picked up by `OPTION_NAMES`.

- [ ] **Step 7: Run the full gate**

```bash
npm run check > /tmp/check1.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e1.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`. The theme e2e spec (`108-theme.spec.js`, 21 tests) is
the one that matters most here.

- [ ] **Step 8: Commit**

```bash
git add src/theme.js test/unit/theme.test.js src/navio.js
git diff --cached --stat
git commit -m "Move theme resolution into its own module"
```

---

## Task 2: Extract `src/settings-storage.js`

**Files:**
- Create: `src/settings-storage.js`
- Modify: `src/navio.js` — remove 1396–1648, construct the factory

**Interfaces:**
- Consumes: nothing from Task 1 (storage does not use the theme).
- Produces:
  ```js
  export function createSettingsStorage(ctx, hooks);
  // ctx:   { nv, instanceId, get selection(), get attribsOrdered(),
  //          get hiddenAttribs(), set hiddenAttribs(v),
  //          get height(), set height(v), getAttribName }
  // hooks: { redraw(), isOpen(), getCollapsed(), setCollapsed(set) }
  // returns { persistSettings, readStoredSettings, maybeRestoreSettings,
  //           settingsSlot, settingsStorageKey }
  ```
  Registers on `nv`: `getSettings`, `setSettings`, `saveSettings`,
  `resetSettings`, `clearStoredSettings`, `getSettingsCode`.

- [ ] **Step 1: Move the code**

Move `src/navio.js:1396-1648` verbatim: `SETTINGS_VERSION` (1396),
`LEGACY_COLOUR_DEFAULTS` (1407), `nv.getSettings` (1412), `nv.setSettings`
(1445), `settingsSlot` (1521), `settingsStorageKey` (1527), `persistSettings`
(1540), `readStoredSettings` (1551), `maybeRestoreSettings` (1567),
`nv.saveSettings` (1585), `nv.resetSettings` (1600), `nv.clearStoredSettings`
(1612), `nv.getSettingsCode` (1625).

Replace the two calls into the panel — `drawSettingsPanel()` at 1490 and 1605 —
with `hooks.redraw()`, and `settingsIsOpen()` at the same two lines with
`hooks.isOpen()`. Replace `collapsedSections` at 1435, 1471–1472 and 1602 with
`hooks.getCollapsed()` / `hooks.setCollapsed(...)`.

- [ ] **Step 2: Wire it in `src/navio.js`**

Construct it beside the theme, with the panel's functions as hooks. At this
point `drawSettingsPanel`, `settingsIsOpen` and `collapsedSections` are still in
`navio.js`, so the hooks close over them directly — this is what makes Task 2
independently green:

```js
const _storage = createSettingsStorage(
  {
    nv, instanceId,
    get selection()      { return selection },
    get attribsOrdered() { return attribsOrdered },
    get hiddenAttribs()  { return hiddenAttribs },
    set hiddenAttribs(v) { hiddenAttribs = v },
    get height()         { return height },
    set height(v)        { height = v },
    getAttribName,
  },
  {
    redraw:       () => drawSettingsPanel(),
    isOpen:       () => settingsIsOpen(),
    getCollapsed: () => collapsedSections,
    setCollapsed: (s) => { collapsedSections = s },
  }
);
const { persistSettings, readStoredSettings, maybeRestoreSettings } = _storage;
```

`pendingSettings` stays in `navio.js` this task — `init()` sets it at line 900
from `readStoredSettings()`, which still resolves.

- [ ] **Step 3: Verify the six public methods survived**

```bash
NAVIO_TEST_PORT=4190 npx playwright test test/e2e/104-describe.spec.js test/e2e/99-settings-key.spec.js
```

Expected: PASS. `104-describe` catches a dropped or newly-snapshotted method;
`99-settings-key` catches a broken storage key, which is the two-instance bug
from #99.

- [ ] **Step 4: Run the full gate**

```bash
npm run check > /tmp/check2.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e2.log 2>&1; echo "EXIT: $?"
```

Expected: both `EXIT: 0`.

- [ ] **Step 5: Commit**

```bash
git add src/settings-storage.js src/navio.js
git commit -m "Move settings serialisation and storage into their own module"
```

---

## Task 3: Extract `src/settings-panel.js`

The largest and last. By now the other two modules exist, so this task's job is
to take ownership: the panel becomes the composition root and constructs the
storage itself.

**Files:**
- Create: `src/settings-panel.js`
- Modify: `src/navio.js` — remove 1249–1395, 1650–1803, 1938–2841

**Interfaces:**
- Consumes: `createTheme` (Task 1), `createSettingsStorage` (Task 2).
- Produces:
  ```js
  export function createSettingsPanel(ctx);
  // returns { initSettingsPanel, drawSettingsPanel, applyTheme, settingsIsOpen,
  //           placeSettingsPanel, toggleSettings, positionButton, destroy,
  //           persistSettings, readStoredSettings, maybeRestoreSettings,
  //           theme, divisionsColour, tooltipBackground }
  ```

- [ ] **Step 1: Move the code and take ownership of the state**

Move the three ranges. The seven owned variables become `let`s inside the
factory: `settingsButton`, `settingsPanel`, `pendingSettings`,
`collapsedSections`, `panelPointerHeld`, `liftedClips`, `defaultSettings`.
Delete them from the chain at `src/navio.js:71`.

`applyTheme` (moved from `navio.js` where Task 1 left it) now lives here, beside
the elements it restyles.

- [ ] **Step 2: Add `positionButton`, which the layout pass needs**

`src/navio.js:4922-4924` reads `settingsButton` directly. It cannot any more.
Export:

```js
function positionButton(top) {
  if (settingsButton) settingsButton.style("bottom", null).style("top", top + "px");
}
```

and change 4923 to `settings.positionButton(ctxHeight - 22)`.

- [ ] **Step 3: Own the listener teardown**

`dismissOnOutsidePointer` is registered as a **capturing** `document` listener
and removed at `src/navio.js:5998` by identity. Registration and removal must
now both live in this module:

```js
function destroy() {
  document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
  if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
  if (settingsButton) { settingsButton.remove(); settingsButton = null; }
}
```

`navio.js`'s `destroy()` calls `settings.destroy()` and nothing else for these.

- [ ] **Step 4: Watch for the shadowed `instanceId`**

`defaultAttribPicker` (2673-2675) destructures a **parameter** named
`instanceId`, shadowing the closure `const` at line 69. Do not rewrite that one
to `ctx.instanceId`. Verify after moving:

```bash
grep -n "instanceId" src/settings-panel.js
```

Expected: the parameter destructure is untouched; only closure-level uses are
`ctx.instanceId`.

- [ ] **Step 5: Run the full gate**

```bash
npm run check > /tmp/check3.log 2>&1; echo "EXIT: $?"
NAVIO_TEST_PORT=4190 npx playwright test > /tmp/e2e3.log 2>&1; echo "EXIT: $?"
wc -l src/navio.js src/settings-panel.js src/settings-storage.js src/theme.js
```

Expected: both `EXIT: 0`; `navio.js` around 4,520 lines.

- [ ] **Step 6: Commit**

```bash
git add src/settings-panel.js src/navio.js
git commit -m "Move the settings panel into its own module"
```

---

## Task 4: The stale-binding regression test

Proves the mechanism, and pins it so a later extraction cannot quietly undo it.

**Files:**
- Create: `test/e2e/67-extraction.spec.js`

- [ ] **Step 1: Write the test**

```js
import { test, expect } from "@playwright/test";

// The mechanism's one distinctive failure mode. init() rebinds `selection` from
// the caller's string to a d3 selection (src/navio.js:710-713), so a context
// that captured it as a plain property would hand the panel the string "#nv".
test("a widget constructed from a string selector still opens its panel", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/basic.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv button").first().click();
  await expect(page.locator("#nv dialog")).toHaveAttribute("open", "");
});
```

Check the fixture name and the panel's selectors against
`test/e2e/89-settings-panel.spec.js` before running — reuse what that spec uses
rather than inventing new ones.

- [ ] **Step 2: Prove it fails without the mechanism**

Temporarily change the context in `src/navio.js` from
`get selection() { return selection }` to `selection,` and run:

```bash
NAVIO_TEST_PORT=4190 npx playwright test test/e2e/67-extraction.spec.js
```

Expected: FAIL. Per `CLAUDE.md`, a test not proven to fail without the fix is
worth nothing. Restore the getter and confirm it passes.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/67-extraction.spec.js
git commit -m "Pin the live-binding contract the extracted modules depend on"
```

---

## Task 5: Correct the stale documentation

**Files:**
- Modify: `CLAUDE.md` — the Layout section
- Modify: issue #67 via `gh issue comment`

- [ ] **Step 1: Update `CLAUDE.md`**

The Layout section says `src/navio.js  ~2800 lines, ONE closure. Almost
everything lives here.` Replace with the measured figure after Task 3 and add
the three new modules. Note the context rule — every non-`const` binding crosses
as a getter — under Landmines, since it is exactly the kind of trap that section
exists for.

- [ ] **Step 2: Comment the outcome on #67**

Per `CLAUDE.md`'s workflow section: report what moved, the measured before and
after line counts, and that the remaining extractions are unstarted.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Record the real size of navio.js and the new module layout"
```

---

## Self-Review

**Spec coverage:** §4 boundary → Tasks 1-3 ranges. §5 getter rule → Global
Constraints + Task 1 Step 5. §5 construction point → Global Constraints. §5
cycles → Task 1 Step 5 (applyTheme stays) and Task 3 Step 1. §5 listener
identity → Task 3 Step 3. §5 `instanceId` shadowing → Task 3 Step 4. §6 file
layout → File Structure. §6 `collapsedSections` open question → decided in
Global Constraints. §7.3 API gate → Task 1 Step 6, Task 2 Step 3. §7.5 new test
→ Task 4. §1 stale docs → Task 5.

**Not covered, deliberately:** §7.4's suggestion to extend
`59-destroy.spec.js`. Task 3 Step 3 moves the listener but adds no assertion.
The executor should read that spec during Task 3 and add an assertion if it does
not already cover the capturing `document` listener — noted here rather than
scripted, because it depends on what the spec already does.

**Type consistency:** `createTheme`/`createSettingsStorage`/`createSettingsPanel`
used consistently; `hooks.redraw`/`isOpen`/`getCollapsed`/`setCollapsed` named
identically in Task 2 Steps 1 and 2; `positionButton(top)` matches its call site.
