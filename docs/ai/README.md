# AI Documentation & Memory

This folder holds durable, checked-in knowledge meant for both humans and AI
coding agents working on Navio — the kind of context that shouldn't live only
in one person's chat history or local notes.

## Contents

- [`FILTERING-MODEL.md`](./FILTERING-MODEL.md) — **read this before touching
  filtering, sorting or selection.** How the level chain, the filter algebra
  and the `selected` flag actually behave, verified by measurement. The
  intuitive model ("a filter is a predicate, re-evaluated on render") is wrong
  in a way that silently misleads; two bugs were found by testing it.
- [`2026-08-01-repo-review-and-roadmap.md`](./2026-08-01-repo-review-and-roadmap.md) —
  full whole-repository review (AI-coding readiness, GitHub issue triage, two
  root-caused bugs, reactive-widget/Inputs.bind compliance gap, vertical
  layout feasibility, performance review) and the resulting project roadmap.
- [`2026-08-20-navio-decomposition-design.md`](./2026-08-20-navio-decomposition-design.md) —
  design for the first slice of #67, extracting the settings panel, its storage
  and the theme out of `src/navio.js`. Its section 11 records the ten defects an
  independent review found in the first draft, because the cause — measuring
  references with greps that count comments, strings and arrow parameters —
  will recur in the remaining extractions.
- [`2026-08-20-navio-decomposition-plan.md`](./2026-08-20-navio-decomposition-plan.md) —
  the five gated tasks that implemented that design.

## Conventions

- Dated review docs (`YYYY-MM-DD-<topic>.md`) are point-in-time audits — treat
  them as a snapshot, not a live source of truth. Re-verify file:line
  references against current code before acting on an old review.
- This folder is for knowledge that should survive `git clone` and reach
  every contributor and every agent — not for personal/machine-local notes
  (those belong in a gitignored `*.local.md`, per
  `AI-CODING-READINESS-CHECKLIST.md`).
