# AI Documentation & Memory

This folder holds durable, checked-in knowledge meant for both humans and AI
coding agents working on Navio — the kind of context that shouldn't live only
in one person's chat history or local notes.

## Contents

- [`2026-08-01-repo-review-and-roadmap.md`](./2026-08-01-repo-review-and-roadmap.md) —
  full whole-repository review (AI-coding readiness, GitHub issue triage, two
  root-caused bugs, reactive-widget/Inputs.bind compliance gap, vertical
  layout feasibility, performance review) and the resulting project roadmap.

## Conventions

- Dated review docs (`YYYY-MM-DD-<topic>.md`) are point-in-time audits — treat
  them as a snapshot, not a live source of truth. Re-verify file:line
  references against current code before acting on an old review.
- This folder is for knowledge that should survive `git clone` and reach
  every contributor and every agent — not for personal/machine-local notes
  (those belong in a gitignored `*.local.md`, per
  `AI-CODING-READINESS-CHECKLIST.md`).
