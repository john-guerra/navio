# Navio — Whole-Repo Review & Roadmap (2026-08-01)

Produced by a fan-out of research agents (no code changes made) against
`/Users/aguerra/workspace/navio` at commit `09a85dd` (`0.0.75`) plus the
uncommitted working tree. Covers: AI-coding readiness, GitHub issue triage,
two reported bugs (root-caused), reactive-widget/`Inputs.bind` compliance,
vertical layout feasibility, and a performance review.

**How to use this doc:** it's a snapshot. File:line references were correct
at review time — re-check them before acting, especially anything touching
`src/navio.js`, which is under active edit (see working-tree diff at review
time).

---

## 0. Executive summary

Navio's core rendering architecture is sound for its stated goal (canvas
marks, pixel-bounded sampling, deferred filter recompute on brush-end — see
§5). The problems blocking the user's asks are concentrated in a handful of
concrete, well-understood defects, not a fundamental design flaw:

1. **"Everything disappears" bug** → a d3-v7-migration regression: a filter
   chip's ✕ handler removes the wrong array index (`splice(undefined, 1)`)
   and fires twice per click, plus an unrelated `||`/`&&` inversion in the
   pos/neg filter split. **High confidence root cause, §3.**
2. **Multi-instance tooltip collision** → tooltip DOM element and the
   `keydown`/`keyup`/`.overlay` handling are scoped to `document.body`
   instead of the per-instance container, so instances stomp each other.
   **A partial fix already exists uncommitted in the working tree — §4.**
3. **`Inputs.bind` / reactive-widget compliance** and **programmatic filter
   setting** are the same underlying gap: Navio exposes no `.value`, no
   `input` DOM event, and no `setFilters()` — only a single-subscriber
   `updateCallback`. This is a known, named gap (`TODO.md`: "Make navio BIND
   work"), not a surprise. **§6.**
4. **Vertical layout** is a real, ~7-year-old open request (#22) that is
   architecturally a **Large** effort — orientation is hand-coded into
   canvas draw primitives and mouse-coordinate inversion, not parameterized.
   **§7.**
5. **Performance** complaints (#37, #4, #23) are **not** an inherent
   SVG/DOM ceiling — canvas + representative-sampling + deferred recompute
   are already correct. The actual drag is unconditional `DEBUG=true`
   console-logging on every mousemove and a scale object rebuilt on every
   pointer event. **§8.**
6. **AI-coding readiness** is currently at Tier 0 failing on 4/5 items — most
   notably `npm test` is broken (points at a `test/test.js` that has never
   existed in the repo's history) and there is no CI at all. **§1.**

---

## 1. AI-coding readiness audit

Audited against the repo's own `AI-CODING-READINESS-CHECKLIST.md`.

### Tier 0 — 4 of 5 items fail or are absent

| Item | Status | Evidence |
|---|---|---|
| `CLAUDE.md`/`AGENTS.md` at root | ❌ Missing | Only the checklist file itself exists (untracked). |
| One-command `npm test` | ❌ **Broken** | `pretest` → `rollup -c` succeeds, then `node test/test.js` → `Cannot find module`. `test/` has **never existed** in git history (`git log --all -- test/` → empty). `jest` was just added to `devDependencies` but has no config and no `*.test.js` files anywhere. |
| Committed lockfile | ✅ OK | `package-lock.json` tracked, not ignored. |
| Explicit guardrails documented | ❌ Missing | No CLAUDE.md/CONTRIBUTING/security policy. |
| `.gitignore` hygiene | ❌ **Fails badly** | One line: `**/.DS_Store`. `node_modules/`, `dist/`, ~9 `example_*` scratch dirs, `extras/` (21MB `.mp4` + 3.6MB PDF + 1.6MB PNG), `TODO.md`, `update.sh`, a `.sketch` file are all trackable-by-accident. |

### Tier 1

- No `docs/AGENT-NOTES.md` (this review starts one, in this folder).
- No `AGENTS.md`, no `.claude/`, no `.mcp.json`.
- **`.github/` does not exist at all** — no CI workflow ever, ever (only GitHub's built-in dynamic `dependabot-updates` workflow).
- Dependabot security-fixes are **enabled but paused**; an open Dependabot PR **#55** (js-yaml bump) has sat unmerged since 2025-11-15; local `main` is 1 commit ahead / 3 behind `origin/main` (missing merged Dependabot PR #51).
- No CodeQL, no issue/PR templates, **no branch protection on `main`** (`404` on the protection API).
- 12 open issues, unlabeled almost entirely, spanning 2018–2025, no grooming evidence.
- `npx eslint src` → **36 errors** (26 auto-fixable), all in `src/navio.js` (30, mostly `indent`, plus `no-prototype-builtins` ×4, `no-unused-vars` ×3 for dead code: `drawFilterExplanations`, `levelOverlay`, `levelOverlayEnter`) and `src/utils.js` (2). Lint is configured (new flat-config `eslint.config.js`, old `.eslintrc.json` correctly staged for deletion) but the codebase doesn't currently pass it.
- **Zero accessibility signals**: `grep -c 'aria-\|role=\|tabindex'` over `src/navio.js` (2274 lines of interactive drag/brush/click UI) → `0`.

### Tier 2

Not yet relevant — no Tier-0/1 baseline to build on. No `SPEC.md`/`specs/`, no CHANGELOG, no risk-tiered approval docs.

### Monolith / code-quality risk

```
   96  src/filters.js
   10  src/index.js
 2274  src/navio.js      (70,637 bytes)
  311  src/scales.js
   77  src/utils.js
```

`src/navio.js` is one top-level function (`function navio(selection, _h) {...}`,
line 35) containing everything as nested closures — 23× the size of the next
biggest file, with exactly **one** top-level function/class in the whole
file. This is the checklist's named "AI-era decay" pattern: one file nobody
dares refactor, and current working-tree churn is concentrated exactly here.

`src/index.js` also has a commented-out import of `src/NavioComponent.jsx` —
an abandoned React wrapper still shipped in `src/` (excluded from npm publish
via `.npmignore`, but still in the git tree, and with no unmount lifecycle —
see §8, finding 2).

### Repo hygiene

- `update.sh` is a personal deploy script hardcoded to the author's own
  `~/Dropbox/dutoVizNew.pem` — machine-specific, untracked, should be
  gitignored or removed.
- Ten `example_*` directories (`example_bid`, `example_callcenters`,
  `example_dump`, `example_fifa`, `example_followers`, `example_mooc`,
  `example_spotify`, `example_tarifa`, `example_tweets`) are untracked,
  ad-hoc scratch dirs never linked from README — genuine cruft, distinct from
  the **tracked, README-linked** `example_d3v3/`, `example_vastChallenge2017/`,
  `example_vispubdata/`, `exampleSenate/`, which are legitimate legacy demos.
- No CHANGELOG; 75 version tags (`v0.0.2`…`v0.0.75`) with no documented
  patch/minor/major policy.

### Top 5 highest-leverage next actions (checklist [S/M/L] sizing)

1. **[S] Fix or honestly stub the `test` script.** It's the one command every
   other tier depends on for a green/red signal, and it's silently broken.
2. **[S] Rewrite `.gitignore`** — add `node_modules/`, `dist/`, all the
   untracked `example_*` scratch dirs, `extras/`, `*.sketch`; decide
   `TODO.md`/`update.sh`'s fate deliberately.
3. **[S] Write `CLAUDE.md`/`AGENTS.md`** — build/test/run reality (test is a
   stub today), the single-closure structure of `src/navio.js`, guardrails
   (never touch `extras/`'s large binaries, never force-push tags).
4. **[M] Add `.github/workflows/ci.yml`** (`npm ci && npm run build && npx
   eslint src`) + turn on branch protection requiring it. Would have caught
   the broken test script and the 36 lint errors on day one.
5. **[M] Start decomposing `src/navio.js`** — extract drag/brush interaction
   and the popper/tooltip wiring into their own modules, matching the
   granularity `filters.js`/`scales.js`/`utils.js` already establish. Pair
   with removing the 3 confirmed dead functions and adding baseline
   `aria-*`/keyboard support to the interactive controls.

---

## 2. GitHub issue triage

11 open issues (verified live against `gh issue list`, not the stale seed
list).

| # | Title | Age | Type | Verdict |
|---|---|---|---|---|
| 53 | visually indicate selections | ~14mo | UX enhancement | **Actionable** — brush indicator disappears when sorting a different column; categorical selections have no visual cue at all; only one brush shown at a time. |
| 43 | Get filter explanations via api call? | ~4yr | API (read) | Small, actionable, unanswered. |
| 42 | Drop columns on read all | ~4yr | API enhancement | Actionable, unanswered. |
| 35 | Issue in angular 7 | ~6.5yr | Bug | Likely stale — filed against an old d3 major; navio is now on d3 v7.8.5. Unverified whether still reproduces. |
| 29 | Attrib Dragging doesn't work on react | ~7.3yr | Bug (no detail) | Too vague to action as-is. |
| 23 | Loader upon brush or click | ~7.3yr | Enhancement | Maintainer: "tried but couldn't do it." Effectively stalled. |
| 22 | Horizontal Navio | ~7.3yr | Enhancement | **Confirms current default is the "horizontal/column" layout** — see §7, this is very likely the same request as the user's "vertical layout" ask, described from the opposite direction. |
| 20 | Add a NavioComponent class for react to the distribution | ~7.4yr | Enhancement | Related to #29/#35 React pain; no progress in 7 years. |
| 15 | [P4] Shrink filtered instances | ~7.5yr | Enhancement/question | Vague, borderline stale. |
| 4 | Show loading indicator when doing large processing | ~8.4yr | Enhancement (todo) | **Still relevant** — direct band-aid ask for the never-fixed perf ceiling (see #37 below, §8). Never implemented. |
| 3 | Desktop application (via Atom) | ~8.4yr | Enhancement (todo) | **Obsolete** — GitHub sunset Atom in 2022. |

### Mapping to the user's current asks

- **(a) Sub-selection-closes → everything disappears:** no existing issue
  describes this exact defect. Closest adjacent: #53 (brush *visual
  indicator* disappearing on re-sort — a different, UI-feedback bug, not
  state loss). **Treat as new** — root-caused in §3.
- **(b) Multi-instance tooltip collision:** no existing issue. Related-but-
  distinct closed issues: #39 ("remove popup when navio is dismounted" — the
  dot-typo in the tooltip selector was fixed in `441fe2b`, but the fix kept
  the selector **global**, which is precisely today's bug — the typo was
  fixed, the global scope wasn't); #11 (Bootstrap CSS class collision, fixed
  by renaming to `_nv_popover`, unrelated to multi-instance); #19, #24
  (readability/positioning, fixed, unrelated). **Root-caused in §4.**
- **(c) `Inputs.bind`/reactive-widget compliance:** no existing issue. #16
  ("Navio :: Observable", closed 2019) was about notebook data-loading UX,
  predates Observable's Inputs/viewof conventions. **New gap, detailed in
  §6.**
- **(d) Programmatic filter API:** no existing issue asks for a *write* API.
  #43 is a *read* API request (filter explanations) — adjacent but distinct.
  **New gap, same root fix as (c), §6.**
- **(e) Vertical layout:** **is** #22 ("Horizontal Navio", 2019, empty body,
  0 comments) — confirms current default orientation and that this has sat
  unaddressed for 7 years. **§7.**
- **(f) Performance:** #37 ("Large datasets handling", closed) was closed
  as *answered*, not *fixed* — anecdotal capacity numbers and a workaround
  tip, no code change. #4 (loading indicator) is the never-implemented
  compensating UX ask. **Root-caused in §8 — the actual fix is smaller than
  either issue implies.**

Two things worth independently double-checking before acting: whether #35
still reproduces on current d3, and that the tooltip-scoping read in this
triage (a quick pass) matches the full trace done in §4.

---

## 3. Bug: "closing a sub-selection makes everything disappear"

### Root causes (ranked by confidence)

**1. HIGH — wrong filter removed on chip-close click.**
`src/navio.js:1139-1144` / `:1198-1203` (the ✕ handler on a filter chip):

```js
.on("click pointerup", (event, f, i) => {
  filtersByLevel[f.level].splice(i, 1);
  applyFiltersAndUpdate(f.level);
});
```

d3 v6+ invokes `.on()` listeners as `(event, datum)` only — there is no
index argument anymore. `i` is always `undefined`. `Array.prototype.splice
(undefined, 1)` coerces to `splice(0, 1)`, so **every chip-close click
removes the filter at index 0 for that level, never the one actually
clicked.** This was introduced by the d3-v7-migration commit `0edd4bcd`,
which mechanically inserted `event` as the first callback arg but left the
now-meaningless `i` in place. It's invisible whenever a level has exactly
one filter (index 0 is the only one anyway) — matching "in **some**
situations."

**2. HIGH (amplifier) — the same handler is bound to two events and
re-entered mid-click.**
Same lines: `.on("click pointerup", handler)` binds one callback to *two*
event types that both fire from a single physical click/tap. Because
`applyFiltersAndUpdate()` (called at the end of the handler) synchronously
re-renders and re-binds a **new** closure over the just-mutated array before
the second event dispatches, the second firing removes a **different**
now-shifted index. Net effect on a 2-filter level: one click can strip
*both* filters instead of the one clicked; on a drill chain, this can cascade
through `deleteSubsequentLevels` (`navio.js:1651-1696`) and collapse more
levels than intended — the best match for "everything disappears." (Note:
the *brush* click handler already got the single-event fix for this exact
pattern in commit `b790936`; the filter-chip ✕ handler was missed.)

**3. MEDIUM (independent, older) — inverted boolean in filter split.**
`src/navio.js:646-651`, inside `applyFilters()`:

```js
posFilters = filtersByLevel[level].filter(
  (f) => f.type !== "negativeValue" || f.type !== "negativeRange"
);
```

This is a tautology (should be `&&`, De Morgan's) — `posFilters` ends up
being the *entire* array, negatives included, whenever a level mixes
positive and negative filters. Introduced in `441fe2b` ("Adding negative
brushes support"), predates the d3 migration — a separate, older defect that
makes the already-corrupted state from bugs #1/#2 even less predictable.

### Reproduction sequence (best guess)

1. Filter by value A at level 0 (drills into level 1).
2. Shift-click to *append* a second filter, value B, at level 0.
3. Click the ✕ on the "== B" chip, intending to keep "== A".
4. `i` is `undefined` → index 0 ("== A") is removed instead; the duplicate
   `pointerup`+`click` firing then removes the newly-shifted index 0
   ("== B") too. Both filters are gone from one click, and
   `applyFiltersAndUpdate`/`deleteSubsequentLevels` collapses the drilled-in
   levels.

### Fix direction (not implemented)

- Remove by identity/value, not position: `splice(filtersByLevel[f.level]
  .indexOf(f), 1)` (or bind index at data-join time via `.each`), in both
  handlers at `navio.js:1139` and `:1198`.
- Collapse `.on("click pointerup", handler)` to a single event, as already
  done for the brush handler in `b790936`.
- Fix `navio.js:650`: `||` → `&&`.
- Treat "resulting filtered set for level L is empty" as a signal to
  re-derive level L cleanly from its parent rather than trusting whatever a
  double-fired handler left in `filtersByLevel[L]`.

---

## 4. Bug: tooltips collide with multiple Navio instances on one page

### Root cause

`src/navio.js:125-133` (HEAD, `b790936`) — `initTooltipPopper()`:

```js
d3.selectAll("._nv_popover").remove();
tooltipElement = d3.select("body").append("div").attr("class", "_nv_popover")
```

The tooltip is appended to `document.body` (not the per-instance
`selection`), and cleanup uses `d3.selectAll("._nv_popover")` — a page-wide
selector that deletes **every** Navio instance's tooltip, not just this
one's. Called from `init()` and every `.data()` call. With two instances:
instance 2's `init()`/`.data()` deletes instance 1's tooltip node out from
under it; instance 1's closure keeps a stale reference to a detached node,
so its tooltip silently stops working (not "visually overlapping" so much as
"last writer wins, loser's tooltip breaks").

A second, related global-state leak, still present: `navio.js:300-317,
362-364` binds `keydown`/`keyup` to `d3.select("body")` — d3's `.on()`
**replaces** same-type listeners on the same node, so only the
most-recently-initialized instance's cursor-swap-on-Alt/Shift behavior
survives, and its handler (`changeCursorOnKey`) queries `d3.selectAll
(".overlay")` — page-wide, touching every instance's brush overlay.

### Historical confirmation

Issue #39 is the same symptom family (*"the nv_popover is added to the body
... not properly removed when the navio component is removed"*) — a
dot-typo in the selector was fixed in `441fe2b`, but the fix kept the
selector **global**, which is exactly today's bug. Commit `0fb5763`
("Adding the tooltip to the body") is what originally moved the tooltip from
a `selection`-scoped element to `document.body` (to fix positioning, related
to #24) — and introduced this regression at the same time.

### Important: a partial fix already exists, uncommitted

The current working tree (`git diff HEAD -- src/navio.js`) already rewrites
this block to scope both the cleanup and the append to `selection` instead
of `body` — structurally correct, **not yet committed**. It does **not**
touch the `body`-scoped `keydown`/`keyup`/`.overlay` leak described above,
which remains live even after that fix lands.

### Fix direction (not implemented)

1. Land/commit the working-tree fix: tooltip container scoped to
   `selection`, not `document.body`/global selectors.
2. Defense in depth: namespace the tooltip class/id per instance (e.g. an
   incrementing instance id) so even a future global query can't cross-wire
   two instances.
3. Namespace the `keydown`/`keyup` listeners (`"keydown.navio-" +
   instanceId`) and scope `.overlay` queries to `selection`, not
   `document`/`body`.
4. Consider adding the `nv.destroy()` teardown API requested (implicitly) in
   #39 — closes the "popup survives dismount" complaint for good, now that
   removal is correctly scoped instead of depending on the next `init()`
   from *any* instance to clean up.

---

## 5. Rendering architecture — what's *not* broken

Worth stating explicitly since it's the backbone of both §7 and §8: data
marks are drawn on `<canvas>` (`drawItem`, `navio.js:541-581`), not one SVG
element per row; SVG is reserved for headers/filter-chips/brush-overlays
(counts bounded by #attributes/#filters/#levels, correctly using d3
enter/merge/exit joins). Rendering is already sub-sampled via
`computeRepresentatives` (`navio.js:1537-1556`) to roughly `2×height` draws
per level regardless of row count. Brush-drag vs brush-end are correctly
separated — the high-frequency `"brush"` event only repositions the
tooltip; the expensive `applyFiltersAndUpdate` runs only on `"end"`. This is
the right architecture for a 200MB-scale widget; the issues below are
hygiene defects layered on top of it, not evidence the architecture needs
replacing.

---

## 6. Reactive-widget (`widgets.org`/Observable Inputs) compliance & programmatic filters

### The verified contract

(Sourced from Observable Framework's `Generators.input` and
`Inputs.bind` implementation.)

- The bindable element needs a live **`.value`** (or a type-specific
  accessor — `valueAsNumber`, `checked`, etc. — but plain `.value` is the
  default/fallback for custom elements).
- It must **dispatch an `"input"` DOM event** (`bubbles: true`) on every
  user-driven change. That's the entire contract — no special class, no
  registration.
- `Inputs.bind(target, source)` wires this **asymmetrically** to avoid
  ping-pong: pushes `source`'s value into `target` on bind, listens for
  `target`'s own "input" to write back into `source` **and re-dispatch**
  on `source` (which then updates `target` again, but doesn't re-dispatch)
  — converging in one pass per interaction.

### Current Navio state vs. the contract

- **No `.value` anywhere.** `navio()` (`navio.js:35`) returns a plain JS
  object (`nv`), not a DOM node — it has no native `addEventListener`/
  `dispatchEvent`. The real DOM container (`selection`) is a separate
  argument, never exposed back as `nv.node()`.
- **No outward DOM events at all.** The only notification path is a
  single-slot callback, `nv.updateCallback` (`navio.js:61`, `2201-2203`),
  called from exactly 3 sites (`:510`, `:749`, `:1691`) with
  `updateCallback(nv.getVisible())` — filtered *rows*, not filter
  *definitions*, and single-subscriber (calling it again clobbers the prior
  callback — no `addEventListener`-style fan-out).
- **No `getFilters`/`setFilters`.** Filters live only in the closure var
  `filtersByLevel` (`navio.js:47`); never assigned to `nv`, never
  returned, no external setter.
- **Filter objects aren't serializable.** `FilterByRange`/`FilterByValue`
  (`src/filters.js`) close over live **data-row references**, and
  `FilterByRange.filter()` compares `d.__i[level]` — a **sort-order-
  dependent position index** (`assignIndexes`, `navio.js:613-618`), not the
  raw attribute value. A portable `.value` representation needs to capture
  `sortAttrib`/`sortDesc` alongside `first`/`last` and re-derive positions
  on rehydrate, or a `setFilters()` on one Navio replayed onto another with
  a different sort order will silently select the wrong rows.
- This is a **known, named gap** — `TODO.md` already lists "Make navio BIND
  work: allow for setting filters, return filters, return filter
  explanations, allow for data update."

### What's needed (design sketch, not implemented)

1. Expose a bindable node: either `nv.node()` returning `selection.node()`,
   or have `nv` delegate `addEventListener`/`dispatchEvent` to the container
   node (lower-disruption option, since existing call sites keep using `nv`
   for everything else).
2. Define a **JSON-safe filter value shape** (type/attribute/raw
   values/sort context per level) and give each `Filter*` a `toValue()`;
   add a `valueToFilters()` that rehydrates by looking up rows by raw value
   (not by object identity).
3. `nv.getFilters()` / `nv.setFilters(value)` / `nv.value` get-set wired to
   that shape, funneled through the existing `applyFiltersAndUpdate`
   pipeline.
4. A single choke point (`notifyChange()`) replacing the 3 raw
   `updateCallback(...)` call sites: keeps `updateCallback` for back-compat,
   adds `node.dispatchEvent(new Event("input", {bubbles: true}))`.
5. **A re-entrancy guard** (`_settingProgrammatically` flag) around
   `setFilters`/`.value =`, so a programmatic set doesn't itself re-dispatch
   `"input"` and loop back through a hand-rolled bidirectional binding
   (`Inputs.bind`'s own asymmetric wiring is safe for one pair, but doesn't
   protect against two independent binds layered on the same node).

### Risks / edge cases to keep in mind when building this

- Navio's filter value is **richer** than the single-scalar convention most
  `Inputs.bind` pairs assume (multiple filters per level, OR'd positives /
  AND'd negatives, nested levels) — binding 1:1 with a simple widget
  (a slider, a search box) will likely need an adapter, not a direct bind.
  This directly touches the same OR/AND logic bug found in §3.3 — worth
  fixing that inversion *as part of* building `toValue()`/`applyFilters`,
  not separately.
- `setFilters` on a level beyond 0 implicitly requires that level to already
  exist (today only reachable by user brushing) — a robust implementation
  needs to synthesize missing levels the same way `applyFiltersAndUpdate`/
  `deleteSubsequentLevels` do, headlessly. This is the nontrivial part TODO.md
  has left unaddressed.

---

## 7. Feature: vertical layout

### Current default orientation (verified)

Navio is **horizontal-flow / column-based** today (parallel-coordinates-like):
`xScale` (`navio.js:380-386`) is horizontal cell width; `levelScale`
(`:387`, `:1628-1639`) lays levels out left-to-right, width growing with
`attribWidth × #attributes × #levels`; `yScales[level]` (`:1606-1608`) is
the *only* per-row scale, over a fixed caller-supplied `height`. There is no
`d3.axis*` call anywhere in the file — every axis/label is hand-drawn, so
there's no existing seam to "just flip."

### Issue #22 ("Horizontal Navio")

Filed 2019-03-20 by the repo owner, **empty body, 0 comments**, still open.
Given today's default is what most people would call "horizontal," this is
very likely the *same 7-year-old request* as the current ask, phrased from
the other direction. `TODO.md:12` ("Make it work vertically") confirms it's
a known, still-unimplemented item — no branch/commit ever touched it.

### Effort estimate: **Large**

Orientation isn't parameterized through a small number of choke points —
`levelScale`+`xScale` (horizontal, combined via an `x()` helper) and
`yScales[]` (vertical, per-level) play *structurally different* roles, not
mirror-image ones. The canvas draw loop (`drawItem`, `:541-581`) encodes
orientation into the drawing primitive itself (horizontal line segments,
thickness = perpendicular bandwidth) — this can't be solved with a CSS/SVG
rotate trick because it's `<canvas>`, labels must stay upright, and mouse
math (brush/drag/tooltip inversion) needs real inverted geometry, not a
transform. At least 6 separate call sites are orientation-specific:
`updateBrushes` (`d3.brushY` vs `brushX`, `:754-790`),
`onSelectByValueFromCoords`/`showTooptip` (coordinate inversion, `:900-999`),
`drawCounts`/`drawFilterExplanations` (`:1065-1207`), `drawAttribHeaders`
(rotation/anchor, `:1209-1271`), `attribDragstarted/Dragged/Ended`
(`event.x` vs `event.y`, `:1352-1407`), and the level-link bezier offsets
(`:1500-1530`).

### Suggested approach (design only)

Add `nv.orientation = "horizontal" | "vertical"`; introduce orientation-aware
primitives (`primaryScale(level)`/`secondaryScale(level)`/`pos(val,
level) → {main, cross}`/`extentBox(level)`) near the existing scale
definitions so each call site routes through one of them instead of literal
`x(...)`/`yScales[...]`; swap `brushY`/`brushX` and the drag-axis read
conditionally; swap the container-sizing formula (which axis "grows with
data" vs. "fixed by caller") per orientation. Ship the horizontal-axis
abstraction first as a behavior-preserving refactor (verify against existing
demos), then implement `"vertical"` as the second mode.

---

## 8. Performance review

### Findings (ranked by impact)

1. **`DEBUG = true` ships in production and logs on every mousemove.**
   `navio.js:32`, never build-stripped (confirmed via `dist/navio.min.js`
   still containing 63 `console.log` sites). Worst offender: `onMouseOver`
   (`:1020-1028`), bound to `"mousemove"` on the brush overlay, logs the
   **entire native event object** on every pixel of movement — keeps
   devtools references alive, blocks GC, and does string/template work
   regardless of whether devtools is open. Other hot paths log unconditionally
   too (`updateSorting`, `applyFilters`, `onSelectByRange`).
   → *Gate `DEBUG` behind a build-time constant or default-`false` runtime
   option; never log raw event objects from a mousemove handler.*

2. **No teardown API; `document.body`-scoped listeners leak.**
   Same root as §4's tooltip bug: `keydown`/`keyup` bound to `body`
   (`:352-354`), `.overlay` queried page-wide via `changeCursorOnKey`
   (`:288-312`), no `nv.destroy()` anywhere, and `NavioComponent.jsx` has no
   `componentWillUnmount`. In a SPA, unmounting a Navio instance never
   detaches the body listener — the whole closure (full dataset, `dData`
   Map, canvas/svg refs) stays reachable forever. With 2 instances, the
   second's `init()` silently replaces the first's body listener.
   → *Scope key listeners and `.overlay` queries to the instance's own
   container; add a real `nv.destroy()`; call it from the React wrapper's
   unmount.*

3. **Tooltip/hover path rebuilds a scale object every mousemove.**
   `invertOrdinalScale` (`:440-448`) constructs a fresh `d3.scaleQuantize()`
   on every call; called from `showTooptip` on every brush-drag mousemove
   *and* plain hover.
   → *Memoize the inverted scale per level; recompute only when
   `yScales`/`xScale` actually change.*

4. **Filter application is an uncached O(rows × filters) scan.**
   `applyFilters` (`:631-682`) re-scans on every filter action with no
   value-indexing, even for simple equality filters that a
   `Map<value, indices>` could answer in O(1). Correctly *not* per-frame
   (only on brush-end/click), but still the dominant cost per click on very
   large datasets once several filters stack up.
   → *Pre-index equality filters per attribute; keep the generic predicate
   path only for range filters.*

5. **`updateColorDomains` rescans the full unfiltered dataset** every call
   (`:1558-1587`, has its own `// TODO: make it compute it based on the
   local range` acknowledging the cost). Lower priority; cache and only
   recompute for changed attributes.

6. **`recomputeVisibleLinks` rescans the full `links` array** on every
   update (`:1732-1738`, called unconditionally from `updateData`). Lowest
   priority — only matters for large `links()` networks.

7. **Minor:** Popper.js **v1** (unmaintained, superseded by Popper v2 /
   Floating UI years ago) runs a synchronous `scheduleUpdate()` inside the
   mousemove tooltip path — not the primary bottleneck, but worth a future
   dependency bump alongside item 3.

### What's *not* a problem

Canvas-based marks (not per-row SVG), pixel-bounded representative sampling,
and correct brush-drag/brush-end separation — see §5. This directly
undercuts issue #23's implicit assumption that dragging itself does O(n)
work per frame; it doesn't. The "slow while brushing" reports are much more
plausibly items 1 and 3 above (both of which *do* run on every mousemove).

### Verdict

Large-dataset complaints (#37, #4, #23) point to a **fixable hygiene
problem, not an inherent SVG/DOM/canvas scaling limit**. Fixing items 1-3 is
low-risk and would likely resolve most perceived "laggy on large data"
reports — and item 2 is the same fix needed for the multi-instance
tooltip/listener bug in §4, so they should be done together.

---

## 9. Consolidated roadmap

Ordered as a practical sequence — hygiene-that-unblocks-everything-else
first, then the two reported bugs (cheap, high-confidence fixes), then the
feature asks (larger, build on top of the bug fixes), then longer-horizon
harness work.

Every item below is tracked as its own GitHub issue (created 2026-08-01) —
see the issue number next to each for status/discussion.

### Now — quick, high-confidence, unblocks trust in "done"
1. **[S]** Fix bug §3: `splice(undefined,1)` → remove-by-identity; collapse
   `"click pointerup"` to one event; fix `||`→`&&` at `navio.js:650`.
   → **[#56](https://github.com/john-guerra/navio/issues/56)**
2. **[S]** Commit the working-tree tooltip-scoping fix (§4) and extend it to
   namespace the `body`-scoped `keydown`/`keyup`/`.overlay` handling — this
   also directly fixes performance finding #2.
   → **[#57](https://github.com/john-guerra/navio/issues/57)**
3. **[S]** Gate `DEBUG`/console logging behind a real flag, default off in
   the shipped bundle (perf finding #1).
   → **[#58](https://github.com/john-guerra/navio/issues/58)**
4. **[S]** Fix the broken `npm test` script and rewrite `.gitignore` — both
   are prerequisites for trusting CI/agent-reported "green" later.
   → **[#63](https://github.com/john-guerra/navio/issues/63)** (test script),
     **[#64](https://github.com/john-guerra/navio/issues/64)** (.gitignore)

### Next — the user's two headline feature asks
5. **[M]** Add `nv.destroy()` teardown (needed for #2 above and for a clean
   `Inputs.bind` lifecycle) and wire it into `NavioComponent.jsx`'s unmount.
   → **[#59](https://github.com/john-guerra/navio/issues/59)**
6. **[M/L]** Build the `.value`/`"input"`-event/`getFilters`/`setFilters`
   layer described in §6 — this is the actual "Inputs.bind compliance +
   programmatic filters" ask, and TODO.md already scopes it correctly. Fix
   the pos/neg filter boolean (§3.3) as part of building `toValue()`, since
   any serialized filter value needs that logic to be correct first.
   → **[#60](https://github.com/john-guerra/navio/issues/60)** (subsumes the
     read-only ask in #43)
7. **[L]** Vertical layout (§7) — genuinely large; sequence it *after* #6,
   since a stable, serializable filter/value model makes it much easier to
   verify layout changes don't alter filtering semantics.
   → **[#22](https://github.com/john-guerra/navio/issues/22)** (existing
     issue, updated with this analysis)

### Ongoing / lower urgency
8. **[M]** Cache/pre-index the O(n) hot paths (perf findings #4-6) — worth
   doing once #1-3 are shipped and re-measured, not before.
   → **[#61](https://github.com/john-guerra/navio/issues/61)** (indexing),
     **[#62](https://github.com/john-guerra/navio/issues/62)** (scale-object
     churn on mousemove)
9. **[M]** Add `.github/workflows/ci.yml` + branch protection; clear the 36
   lint errors; decompose `src/navio.js` incrementally as you touch it for
   the above (drag/brush logic and tooltip/popper wiring are natural first
   extractions).
   → **[#65](https://github.com/john-guerra/navio/issues/65)** (CI/branch
     protection), **[#66](https://github.com/john-guerra/navio/issues/66)**
     (eslint errors), **[#67](https://github.com/john-guerra/navio/issues/67)**
     (decomposition)
10. **[S]** Add baseline `aria-*`/keyboard support to the drag/brush/filter
    UI — currently zero signals in an interactive widget library.
    → **[#68](https://github.com/john-guerra/navio/issues/68)**
11. **[S]** Groom the 11 open issues (§2) against this roadmap — several
    (e.g. #22, #37/#4/#23) can likely be closed or re-scoped once the above
    lands; #3 and #29/#35 need a relevance check (Atom is dead; d3 has moved
    on since #35 was filed). Also add the repo-root agent guide:
    → **[#69](https://github.com/john-guerra/navio/issues/69)**
    (CLAUDE.md/AGENTS.md). Grooming comments already posted on #22, #23,
    #37, #39, #43 linking them to the new tracked issues above.

---

## 10. Testing strategy (implemented 2026-08-01, closing #63)

Two tiers, not one framework trying to do both — chosen after research into
what D3 itself does and the 2026 e2e landscape (see issue #63 for full
rationale and sources):

- **Vitest** (`test/unit/`, `vitest.config.js`) for fast, pure-logic unit
  tests — `src/filters.js`, `src/scales.js`, `src/utils.js`. Chosen over
  Jest after hitting real ESM-transform friction (Jest+babel-jest fighting
  `d3`'s ESM-only sub-packages) that Vitest (built on Vite) avoids natively.
  Run via `npm test`.
- **Playwright** (`test/e2e/`, `playwright.config.js`) for browser-level
  e2e/visual tests — anything jsdom fundamentally can't model: canvas
  rendering (`drawItem` has no DOM to assert against — only pixels), real
  brush/drag pointer math (`d3-brush` needs real `getBoundingClientRect()`,
  which jsdom always returns as zero), and multi-instance-on-one-page
  scenarios (§4). Fixtures under `test/e2e/fixtures/` use the local
  `node_modules` UMD builds of `d3`/`popper.js` (no CDN dependency, no
  network flakiness in CI). Run via `npm run test:e2e` (builds first).

Why this matters for the rest of the roadmap: **#56** (filter-chip bug) and
**#57** (tooltip collision) should get their regression coverage as
Playwright specs, not Vitest/jsdom ones — the bugs are specifically about
real event-dispatch ordering (`click` vs `pointerup`) and real cross-instance
DOM state, which a synthetic DOM can't faithfully reproduce. **#22**
(vertical layout) should lean on Playwright's `toHaveScreenshot()` visual
regression to catch canvas rendering breakage. Pure filter-value logic
(§6, `toValue()`/`valueToFilters()` for **#60**) belongs in Vitest.

---

*Sources: 7 parallel research agents (repo/checklist audit, GitHub issue
triage, two bug root-cause traces, reactive-widget/Inputs.bind gap analysis,
vertical-layout feasibility, performance review), synthesized 2026-08-01.
Testing-strategy research (§10) added same day before implementation began.*
