# Decomposing `src/navio.js` — design for the first slice (2026-08-20)

Design for issue [#67](https://github.com/john-guerra/navio/issues/67), written
against commit `1fe4068`. Covers **one** extraction — the settings panel, its
storage and the theme — chosen to establish a mechanism the remaining
extractions can reuse. It is deliberately not a plan for all of `navio.js`.

**How to use this doc:** it is a snapshot. `src/navio.js` is under active edit;
re-check line references before acting on them.

**Revision note.** A first draft of this spec was reviewed by an independent
agent and found **unsafe to implement** — three of its claims would each have
produced a broken landing. The defects were traced to one methodological cause:
the draft measured references with `\b<name>\b` greps over raw source, which
count comment prose, string literals and arrow-function parameters as real
references, and which cannot see a function passed by identity rather than
called. Every number below has been re-measured with comments and string
literals stripped (line-count-preserving), and §4 is now built from **reference**
sites rather than assignment sites. §11 records what the draft got wrong, because
the failure mode is more reusable than the result.

---

## 0. Summary

`src/navio.js` is **6,113 lines** — one closure holding ~98% of the file. This
design extracts **1,593 lines** (lines 1249–2841, 26%) into three modules using
a factory-plus-injected-context mechanism.

Four variables become genuinely module-private. That is a smaller win than the
draft claimed, and §4 states the honest accounting.

---

## 1. Why this is worth doing now

The issue's central number is stale by a wide margin:

| Source | Claim |
| --- | --- |
| Issue #67 (2026-08-01) | 2,274 lines / 70,637 bytes |
| `CLAUDE.md` | "~2800 lines" |
| `wc -l src/navio.js` at `1fe4068` | **6,113 lines** |

Measured growth: 2,301 lines at the last commit before 2026-08-02 → 6,113 now,
**2.66× in under three weeks**, concentrated in the settings panel and theme work
of 0.3.x. The next-largest file in `src/` is `params.js` at 655 lines.

Both the issue and `CLAUDE.md` must be corrected as part of this work.

### Success criterion

No file over ~800 lines, each with a name that says what is in it. Seams follow
topics. This is a **navigability** goal — for humans and for agents that cannot
hold 6,113 lines in context — not a performance or bundle-size goal.

---

## 2. The structure being changed

```
function navio(selection, _h) {      // line 67
  let nv = this || {},               // line 71 — ONE declaration chain
    data = [], dataIs = [], ...      // 50 bindings, ending at cursorData
  ...
}                                    // line 6060
```

The chain holds **50 bindings** (enumerated by parsing its indent-4
continuation lines). There are **107** `nv.<name> =` assignments — the public API
is built by assignment onto the closure's `nv` object.

### The core difficulty, stated once

Those 50 variables are **closure bindings, not object properties**. `xScale = …`
rebinds the variable itself. A module can import a *value* but can never
reassign a binding it imported. So any extraction must convert every rebind of a
shared variable into a property write on a shared object, and every *read* into
a property read that resolves at access time rather than at construction time.

This interacts with a documented landmine in `CLAUDE.md`: *"Rollup will
constant-fold a property that is only ever read."* Changing bindings into
properties changes what Rollup can prove — and note the direction: routing reads
through a getter makes Rollup able to prove **less**, not more. The expected
bundle effect is mild growth, not shrinkage. §7 is corrected accordingly.

---

## 3. Choosing the slice

Eight candidate regions were compared on dependency surface. **Treat this table
as a sanity check on an argument, not as a measurement that decides it** — the
comparison was produced by the flawed grep described in §11, and only the
winning row has been re-verified. The corrected winning row is
`exports 14 · state 14 · calls-out 5 · iface 33 · lines/iface 48`, which still
beats every other candidate's uncorrected figure, and the runners-up would only
move in the same direction.

| Candidate | Lines | lines/iface (uncorrected) |
| --- | ---: | ---: |
| **settings panel + theme** | **1541** | **42** (corrected: 48) |
| settings panel only | 1321 | 32 |
| header band / labels | 248 | 16 |
| tooltip (scattered) | 346 | 15 |
| colour domains + scales | 277 | 13 |
| filter chips / counts | 172 | 10 |
| theme only | 110 | 10 |
| drag/drop columns | 126 | 7 |

The slice also wins on two properties the ratio does not capture: it is
**contiguous** (the tooltip is split across 477–694 and 3471–3598), and it is
the best-tested region of the codebase.

| Suite | Files | Tests |
| --- | ---: | ---: |
| Unit (vitest) | 11 | 93 (192ms) |
| E2E (Playwright) | 47 | **286** |
| E2E matching `settings\|theme\|panel` | 18 | **129 (45%)** |

Issues #99–#103 were settings-panel and theme bugs and each left a spec behind.
(#104 and #105 were *not* — they are the API-surface and sort-by-name specs. The
draft overclaimed the range.)

---

## 4. Boundary, and what actually crosses it

### The boundary is 1249, not 1301

The draft chose 1301 (`const fromParams`). That is wrong: `OPTION_ACCESSORS`
(1274) is settings-panel code, and it **calls into the slice** —

```
src/navio.js:1281-1282     toggleSettings(false);
                           toggleSettings(true);
```

— which are the only two outside references to `toggleSettings`. Splitting at
1301 would create a gratuitous cycle. The natural seam is `src/navio.js:1249`,
a section-divider comment; `visibleAttribs` (1243) is the last non-panel thing
above it. Moving the boundary also removes `toggleSettings` from the export
list.

### Reference sites, not assignment sites

The draft's inventory was built from assignment sites and therefore missed
read-only cross-boundary uses — which are exactly what break an extraction.
Rebuilt from every reference:

| Variable | Sites | Verdict |
| --- | --- | --- |
| `panelPointerHeld` | decl 124; 1746, 2179 | **module-private** |
| `liftedClips` | decl 127; 2084, 2108 | **module-private** |
| `defaultSettings` | decl 140; 1573 | **module-private** |
| `pendingSettings` | decl 113; 1576; init 900 | module-private + initializer |
| `collapsedSections` | decl 121; 1435, 1471–1472, 1602, 2252–2253 | module-private, but see §6 |
| `settingsPanel` | 1653, 1696; destroy 6002; **read by `applyTheme` 1924** | private to the module, shared across its files |
| `settingsButton` | 1653, 1676; destroy 6006; **read by `applyTheme` 1920-1922**; **read by layout 4923** | needs an exported positioner |
| `hiddenAttribs` | decl 82; read 1430; write 1481; **5726, 5727, 5817, 6038** | **stays shared** (get **and** set) |

`settingsButton` is the correction that matters most:

```
src/navio.js:4922-4924
    // Keep the gear against the bottom of the CANVAS, not of the container.
    if (settingsButton)
      settingsButton.style("bottom", null).style("top", ctxHeight - 22 + "px");
```

That is ~2,000 lines below the slice, inside the layout pass, and it is a *read*,
so no assignment scan could find it. The module must export
`positionButton(top)` — a 15th entry in the contract.

### The shared state the slice actually reads

Re-measured with comments and string literals stripped:

| Variable | Refs in slice |
| --- | ---: |
| `selection` | **14** |
| `attribsOrdered` | 13 |
| `x` | 4 |
| `height` | 3 |
| `hiddenAttribs` | 2 |
| `tooltipElement` | 2 |
| `dataIs` | 1 |
| `canvas` | 1 |
| `data`, `id`, `colScales`, `context`, `tooltip` | **0** |

The draft asked for getters on all five of the zero-reference variables. They are
dead and must not be written. The draft's headline example — *"`updateData`
reassigns `data`, so the module would render stale columns"* — is about a
variable this slice never touches.

### Honest accounting of the state reduction

The draft claimed *"the shared surface goes from ~46 to ~40"* and called that the
justification for the whole refactor. Corrected:

- The chain holds **50** bindings, not 46.
- **4** become genuinely module-private: `panelPointerHeld`, `liftedClips`,
  `defaultSettings`, `collapsedSections`.
- `pendingSettings` leaves but keeps one call back in (`init` at 900).
- `settingsButton` and `settingsPanel` are still reached from outside — by
  `applyTheme` and by the layout pass — now across a module boundary through an
  indirection layer rather than within one closure.

So: **50 → 45**, and two of those five are relocation rather than removal. This
refactor is justified by navigability (§1), not by a state-reduction headline.
The draft's claim is withdrawn.

---

## 5. Mechanism

### Rule: every non-`const` closure binding crosses as a getter

Stated as a rule rather than decided per variable, because the draft got exactly
one per-variable judgement wrong and it was a blocker.

Only two things may cross as plain properties: `instanceId` (line 69, `const`)
and `nv` (never rebound — verified). **Everything else is a getter.**

The binding this rule saves is `selection`:

```
src/navio.js:710-713   (inside init())
    selection =
      typeof selection === typeof "" ? d3.select(selection) : selection;
    selection =
      selection.selectAll === undefined ? d3.select(selection) : selection;
```

`init()` is called at line 6058 — *after* any construction point. A context that
captured `selection` as a plain property would hold whatever the caller passed,
which for every fixture and example is the **string** `"#nv"`. Then
`initSettingsPanel` (reached from `init` at 896, after 710) would evaluate
`"#nv".append("button")` → TypeError. It works today only because the closure
re-reads the rebound binding. `selection` is the slice's single most-referenced
shared value at 14 uses.

### Construction point: at the slice's own location, never hoisted

The factory must be invoked where the slice used to be (~line 1249), and this
must not be "tidied" upward. Two independent constraints:

1. **`OPTION_NAMES`.** `src/navio.js:336` is
   `const OPTION_NAMES = new Set(Object.keys(nv))`, and the comment at 436-438
   says so explicitly: *"a snapshot of nv's own keys taken before these
   functions are defined, so they are never in it."* The module registers 7
   methods onto `nv`. Constructing it before 336 puts all 7 into
   `nv.getOptions()`, makes `applyOptions` accept `{getSettings: …}` as an
   option, and **fails `test/e2e/104-describe.spec.js`**, which asserts every
   key of `getOptions()` is described in `src/params.js`.
2. **TDZ.** `OPTION_ACCESSORS` is a `const` at 1274 and `fromParams` is invoked
   eagerly at 1308/1310/1321. Constructing earlier throws
   `ReferenceError: Cannot access 'OPTION_ACCESSORS' before initialization`.

### The context

```js
// built at ~line 1249, where the slice used to be
const settings = createSettingsPanel({
  nv,                    // plain: never rebound
  instanceId,            // plain: const

  get selection()      { return selection },       // 14 refs; REBOUND in init()
  get attribsOrdered() { return attribsOrdered },
  get x()              { return x },
  get canvas()         { return canvas },
  get tooltipElement() { return tooltipElement },
  get dataIs()         { return dataIs },

  get height()        { return height },        set height(v)        { height = v },
  get hiddenAttribs() { return hiddenAttribs }, set hiddenAttribs(v) { hiddenAttribs = v },

  init, announce, visibleAttribs, getAttribName, moveAttrToPos,
});
```

`height` needs a setter for `maybeRestoreSettings` (1473); its only write
outside the slice is the `nv.height` setter at 5834. `hiddenAttribs` needs
**both** — read at 1430, written at 1481, and written from four sites outside.

### Breaking the cycles

The draft's flat single-factory sketch is not implementable: the three proposed
files form two runtime cycles.

- `applyTheme` (theme) reads `settingsButton`/`settingsPanel` (panel) at
  1919-1925, while the panel's `styleButton`→`styleControl` calls `theme()` from
  8 sites at 2605–2834.
- `nv.setSettings` (storage) calls `drawSettingsPanel()` at 1490 and
  `nv.resetSettings` at 1605, while the panel calls `persistSettings()` from ten
  sites and `nv.getSettingsCode()`/`nv.resetSettings()` at 2609/2639.

Function-declaration cycles survive ES modules; **factories returning objects do
not** — neither can be constructed first.

The fix is to make two of the three files non-factories:

- **`theme.js` exports pure functions.** `theme(nv, prefersDark)`,
  `divisionsColour(…)`, `tooltipBackground(…)`, `backgroundBehind(el)` and the
  `THEMES` table take what they need as arguments and hold no state. `applyTheme`
  — which is a DOM side-effect over the panel's own elements — **stays in
  `settings-panel.js`**. This alone removes the theme cycle, and makes `theme.js`
  a true leaf with no imports from its siblings.
- **`settings-storage.js` exports a factory that takes callbacks.**
  `createSettingsStorage(ctx, { redraw, isOpen })`. The panel constructs it and
  passes its own `drawSettingsPanel`/`settingsIsOpen`. Dependency runs
  panel → storage only.
- **`settings-panel.js` is the composition root** for the slice: it imports the
  other two, owns the state, and is the single thing `navio.js` constructs.

Resulting import graph is acyclic: `navio.js` → `settings-panel.js` →
{`settings-storage.js`, `theme.js`}.

### Listener identity

`dismissOnOutsidePointer` (declared 2184) is referenced — not called — at
`src/navio.js:5998`, inside `destroy()`:

```js
document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
```

It is a **capturing** listener on `document`, so removal requires the same
function identity. The module must own both registration and removal inside its
own `destroy()`; `navio.js`'s `destroy()` calls `settings.destroy()` and nothing
else. If the two ever hold different closures, every `navio()` instance leaks a
document-level handler. The draft's export list missed this entirely, because a
callback passed by identity has no `(` after it.

### The module's contract

- **In:** `nv`, `instanceId`, 6 getters, 2 get/set pairs, 5 callbacks.
- **Out (14):** `persistSettings`, `readStoredSettings`, `maybeRestoreSettings`,
  `initSettingsPanel`, `theme`, `divisionsColour`, `tooltipBackground`,
  `applyTheme`, `settingsIsOpen`, `placeSettingsPanel`, `drawSettingsPanel`,
  **`positionButton(top)`** (for layout, 4923), plus `destroy()`.
  `toggleSettings` leaves the list once the boundary moves to 1249;
  `dropClipsForPanel`'s only outside caller is `destroy()` (5992), so it becomes
  internal too.
- **Side effect:** registers **7** public methods on `nv` — `getSettings` (1412),
  `setSettings` (1445), `saveSettings` (1585), `resetSettings` (1600),
  `clearStoredSettings` (1612), `getSettingsCode` (1625), `resolvedTheme` (1870).
  Verified there are no others; `nv.nestedFilters = this.checked` at 2589 is an
  option write, not a method definition.
- **Module imports:** `d3` (11 uses) and `PARAMS` (2). `d3` is `external` in
  `rollup.config.js`, so importing it in three new files is free.

`src/params.js` is the single description of every option and method and
`docs/ai/API.md` is generated from it. Moving these 7 methods must not change
their names, arity or behaviour.

### One hazard for a mechanical rewrite

`defaultAttribPicker` (2673-2675) destructures a parameter named `instanceId`,
**shadowing** the closure `const instanceId` at line 69. A find-and-replace of
`instanceId` → `ctx.instanceId` inside the moved file would silently change
which value that body sees.

---

## 6. File layout

Line ranges and sizes derived from actual declaration lines, not apportioned to
fit a total:

| File | Range | Lines | Contents |
| --- | --- | ---: | --- |
| `src/theme.js` | 1804–1937 | **~134** | `THEMES` (1804 — omitted from the draft, and `theme()` cannot work without it), `theme`, `divisionsColour`, `tooltipBackground`, `backgroundBehind`. Pure functions, no state, no sibling imports. |
| `src/settings-storage.js` | 1396–1648 | **~253** | `SETTINGS_VERSION`, `LEGACY_COLOUR_DEFAULTS`, `settingsSlot`, `settingsStorageKey`, `persistSettings`, `readStoredSettings`, `maybeRestoreSettings`, and the 6 storage methods on `nv`. Factory taking `{redraw, isOpen}`. |
| `src/settings-panel.js` | 1249–1395, 1650–1803, 1938–2841 | **~1,205** | `OPTION_ACCESSORS`, `fromParams`, `LIVE_*`, `CONTROL_BOX`, styling, `initSettingsPanel`, `applyTheme`, positioning, `toggleSettings`, `settingsSection`, `drawSettingsPanel` (2291–2657), `defaultAttribPicker` (2659–2841). Composition root. |

`collapsedSections` is read and written at 1435 and 1471–1472 — inside the range
assigned to `settings-storage.js` — and at 2252–2253 in the panel. §4 calls it
module-private; it is private to *the slice*, not to one file. It lives in
`settings-panel.js` and is reached by storage through the injected context, or
it moves into storage and the panel reaches it through the storage object. The
draft asserted "move in" without noticing it straddles two of its own files.
**Decide this at implementation and record the choice.**

`settings-panel.js` at ~1,205 misses the ~800 criterion by 51%. That is
accepted for this pass: `drawSettingsPanel` and `defaultAttribPicker` are a
single coherent rendering unit, and splitting on a line count rather than a seam
would produce two files neither of which can be understood alone. Revisit once
later extractions show where the real seam is.

`navio.js` ends this pass at roughly **4,520 lines** — still far too big, and
still the subject of #67. This slice buys a mechanism, not a finished job.

---

## 7. Verification

Behaviour-preserving refactor: **the existing tests are the specification.**

1. **Baseline before touching anything.** Capture `npm run check` and a full
   Playwright run. Per `CLAUDE.md`, redirect to a file and test `$?` — never grep
   output for "error", because a rollup `SyntaxError` does not match a grep for
   lowercase `error`, and that mistake has already pushed a red build here.
2. **Port discipline.** `NAVIO_TEST_PORT=4190 npx playwright test`.
   `reuseExistingServer` only checks that *something* answers on the port.
3. **The public-surface gate is `test/e2e/104-describe.spec.js`.** It asserts
   every key of `nv.getOptions()` appears in `src/params.js`, and it is what
   catches the `OPTION_NAMES` hazard in §5. The draft instead proposed *"run
   `docs:api`, confirm `API.md` is unchanged"* — a **vacuous** check: `API.md` is
   generated from `src/params.js`, which this refactor does not touch, so that
   diff can never fail. Note also that `npm run check` does **not** run e2e, so
   the `OPTION_NAMES` defect would land green on the gate.
4. **Two named specs for the two identity/position hazards.**
   `test/e2e/59-destroy.spec.js` must be read and, if it does not already assert
   that the `document` `pointerdown` listener is gone, extended — that is the
   `dismissOnOutsidePointer` risk in §5. And a two-instance layout assertion
   covers `positionButton` (4923).
5. **One new test.** The mechanism's distinctive failure mode is a stale
   binding, and the binding at risk is **`selection`** (not `data`, as the draft
   said). A spec that constructs Navio with a **string selector** — as every
   example does — and then opens the settings panel distinguishes a getter
   context from a plain-property one: the latter throws. Per `CLAUDE.md`, prove
   it fails first by building the context with plain properties deliberately.
6. **Bundle.** `verify-bundle.js` runs on postbuild and enforces the
   UMD-callable and ASCII rules; the slice's only non-ASCII glyph is `⚙` at 1689
   and `build/ascii.js` has no include filter, so that landmine is not triggered.
   The draft's *"an unexpected shrink signals constant-folding"* heuristic is
   **dropped**: moving 1,593 lines behind a property-indirection layer changes
   minified output substantially in both directions, and the expected direction
   is growth (§2), so a size delta carries no diagnostic content. Grep
   `dist/navio.min.js` for a known theme-branch string instead.
7. **Per-commit gate.** Three commits — `theme.js` → `settings-storage.js` →
   `settings-panel.js` — each with `npm run check` **and** the e2e suite green
   before the next. This order is now safe: `theme.js` is a pure leaf, so it no
   longer has to reach `settingsButton`/`settingsPanel` and does not get rewritten
   by commit 3. Under the draft's layout it would have been.

---

## 8. Alternatives considered

**Convert the whole `let` chain to a state object first.** Rejected for this
pass: it edits all 6,113 lines in one commit — the big-bang #67 warns against —
and disturbs Rollup's view of every variable at once, so a constant-folding
regression would be near-impossible to bisect. Worth revisiting *after* this
slice proves the seams.

**Extract as pure functions with explicit arguments.** Rejected as the primary
mechanism because `drawSettingsPanel` alone would need an unusable signature —
but adopted for `theme.js` (§5), and it remains right for leaf helpers inside
the new modules (`toHex`, `clampToViewport`, `capAttribList`), which should be
exported as pure functions and unit-tested directly. This is a change from the
draft, and it is what breaks the theme cycle.

**Do nothing / extract incrementally as other issues touch the area.** What #67
itself recommends. Rejected because the measured growth rate (2.66× in three
weeks) outpaces incidental cleanup, and because the panel is currently
well-tested — a property that decays as the file grows.

---

## 9. Measuring this file

Probe scripts belong **outside the repo** (`CLAUDE.md` Guardrails). The method
that matters is not the script but two rules:

1. **Strip comments and string literals before counting references**, and do it
   line-count-preservingly — replacing `/* … */` with `""` shifts every
   subsequent line number and silently corrupts the results. This is what
   produced the draft's six dead getters.
2. **Count reference sites, not assignment sites**, and match identifiers
   without requiring a following `(` — a function passed as a callback
   (`dismissOnOutsidePointer`) and a read-only use (`settingsButton` at 4923)
   are both invisible otherwise, and both were blockers.

Even corrected, these are textual measurements over one file, not scope
analysis. They are good enough to compare candidate slices and enumerate
reference sites. They are **not** good enough to drive an automated
transformation — `const`-declared functions (`OPTION_ACCESSORS`, `LIVE_OPTIONS`,
`CONTROL_BOX`, `THEMES`) do not match a `function` declaration regex at all.

---

## 10. Out of scope

- The other 8–10 extractions. This pass establishes a mechanism; whether to
  continue is a decision to make after seeing it land.
- `nv.orientation` / vertical layout (#22), which has its own analysis and must
  not be attempted piecemeal.
- Any behaviour change, API change, or new setting. If this refactor changes
  what a user sees, it has failed.

---

## 11. What the first draft got wrong

Kept because the failure mode generalises to the remaining extractions.

| # | Defect | Cause |
| --- | --- | --- |
| 1 | `selection` passed as a plain property, though it is rebound inside `init()` at 710-713 and used 14× in the slice | The rebind is `selection =` at end-of-line; the grep required the value on the same line |
| 2 | Factory constructed "after the let chain", which registers 7 methods before `OPTION_NAMES` snapshots at 336 | Never checked when `nv`'s keys are read |
| 3 | Same construction point is a TDZ error on `OPTION_ACCESSORS` (1274) | Never checked what the slice evaluates eagerly |
| 4 | Two runtime cycles between the three proposed files | Confused function-declaration hoisting (cycle-tolerant) with factory construction (not) |
| 5 | Six getters for variables with zero real references | `\b<name>\b` matched comment prose and the base64 `data:image/svg+xml` literals |
| 6 | Export list missed `dismissOnOutsidePointer` | Regex required `(` immediately after the name |
| 7 | `settingsButton` marked "move in" despite a read at 4923 | Inventory built from assignment sites only |
| 8 | "Shared state 46 → 40" | Miscounted the chain (50) and counted relocation as removal |
| 9 | Per-file line estimates apportioned to sum to 1,541 | Not derived from declaration lines |
| 10 | `docs:api` proposed as the API-surface check | `API.md` is generated from `params.js`, which this refactor does not touch — the check cannot fail |

The common thread: **a textual grep answers a different question than the one
being asked**, and every one of these was found by re-measuring rather than by
re-reading. Any future extraction under #67 should re-measure with the two rules
in §9 before trusting a boundary.
