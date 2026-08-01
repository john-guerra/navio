# AI-Coding Readiness Checklist for a GitHub Project

A project-agnostic checklist for **starting a new repo** or **adapting an existing
one** so that AI coding agents (Claude Code, Codex, Copilot coding agent, Cursor, …)
can work in it safely, productively, and to a high engineering standard — without
over-engineering.

**Grounding:** distilled from the 2026 state-of-the-art brief
(`aiCoding_Course/docs/research/ai_coding_course_sota_2026.md`) and applied against a
real audit (`docs/AI-CODING-REVIEW-2026-07-24.md`).

**How to use it.** Don't do everything at once. Walk the tiers:
**Tier 0** (minimum viable harness — do first, ~an afternoon) →
**Tier 1** (the productive baseline most projects should reach) →
**Tier 2** (scaling to teams, autonomy, and long-running agents).
Every item is marked **[S/M/L]** for effort. Skip anything that doesn't earn its keep
— a harness component is technical debt with a ~90-day half-life; add it only when it
encodes an assumption the model can't yet handle on its own.

The north star: **`Agent = Model + Harness`.** Everything below is harness — the
scaffolding that turns a capable model into a reliable contributor to _your_ codebase.

---

## Tier 0 — Minimum viable harness (do this first)

- [ ] **Agent guide at the repo root.** Add `CLAUDE.md` (and/or `AGENTS.md` — see
      Portability) with: what the project is, how to build/test/run, the 3–5 conventions
      that matter, and the **traps that cost you an afternoon** (with the _mechanism_, not
      just the rule). This is the single highest-leverage artifact. **[S]**
- [ ] **One-command build, test, run.** `npm test` / `make test` must work from a clean
      clone with no tribal setup. Agents (and CI) rely on a green/red signal. **[S]**
- [ ] **A committed lockfile** (`package-lock.json`, `poetry.lock`, `Cargo.lock`, …).
      Non-negotiable supply-chain baseline; enables reproducible, hash-verified installs.
      **[S]**
- [ ] **Explicit guardrails / action boundaries** in the agent guide: what the agent
      must _never_ touch (production data, user files, credentials), and destructive-action
      policy (**prefer soft-delete + undo over hard delete**). **[S]**
- [ ] **`.gitignore` hygiene** — no `.DS_Store`, no secrets, no build artifacts, no
      local-only config in the tree. Noise pollutes every agent diff and directory listing.
      **[S]**

---

## Tier 1 — The productive baseline

### Memory & portable knowledge

- [ ] **Keep durable project knowledge _in the repo_, not in a per-user/per-machine
      store.** Release process, flaky tests, "why we do X", non-obvious constraints belong
      in a checked-in doc (`docs/AGENT-NOTES.md` or a section of the agent guide) so they
      survive `git clone` and reach CI, teammates, and every agent. **[M]**
- [ ] **Separate personal/local notes** (paths, machine-specific setup) into a
      gitignored `*.local.md` — private stays private, shared stays shared. **[S]**
- [ ] **Write memories as one fact each, with a relevance hook**, and keep an index.
      A memory that names a file/flag should be re-verified before you act on it — memories
      reflect what was true when written. **[S]**

### Portability across agents

- [ ] **`AGENTS.md`** — the emerging cross-vendor standard. Even a thin one that points
      to your `CLAUDE.md` makes the repo legible to Codex/Cursor/other agents. **[S]**
- [ ] **Committed agent config baseline** — a shared `.claude/settings.json` (permissions,
      hooks) so every contributor's agent starts from the same baseline, not each person's
      `settings.local.json`. **[S]**

### Skills & repeatable workflows

- [ ] **Encode recurring multi-step workflows as checked-in skills / commands**
      (`.claude/skills/`, `.claude/commands/`, slash-commands): release, "run the app and
      verify", "add a feature end-to-end". Turns tribal knowledge into reusable harness.
      **[M]**
- [ ] **Sub-agent / delegation patterns** you rely on (e.g. delegate mechanical work to
      a cheaper model; fan out parallel reviewers) should be documented or codified, not
      re-improvised each session. **[M]**

### MCP servers

- [ ] **Commit an `.mcp.json`** for the MCP servers the project's workflow assumes
      (browser automation for UI verification, a DB inspector, Playwright, an issue
      tracker). Makes the tool surface reproducible instead of per-developer. **[M]**
- [ ] **Apply MCP security hygiene** — treat MCP tool output as untrusted input; be
      aware of the **lethal trifecta** (private data + untrusted content + external comms =
      exfiltration risk) and **Meta's Rule of Two** (an agent should satisfy at most two of
      those three without human approval). **[S]**

### GitHub integration

- [ ] **CI gates the right things on every push/PR:** format/lint → tests → build.
      Include a **build step even if unit tests pass** — it catches integration/import
      breakage a pure unit suite can't see. **[M]**
- [ ] **Dependabot** (`.github/dependabot.yml`) + **CodeQL / code scanning** +
      a **scheduled production-tree dependency audit** — the automated backstop for the
      supply-chain discipline (slopsquatting: ~20% of AI-suggested packages are
      hallucinated). **[S]**
- [ ] **Issue & PR templates** (`.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`).
      A bug template that captures **repro steps** institutionalizes "verify against the
      reported scenario." **[S]**
- [ ] **Branch protection** on the default branch — require green CI + review before
      merge (this is where a human owns the final gate on agent output). **[S]**
- [ ] **Backlog lives in GitHub Issues**, labeled (bug/enhancement), so agents can be
      pointed at a well-scoped unit of work — and, later, cloud coding agents can be
      _assigned_ one. **[S]**

### TDD & verification-first

- [ ] **Tests are the specification.** Adopt red → green explicitly: write the failing
      test, confirm it fails, implement to green _without editing the test_. Agents default
      to implementation-first, so this must be prompted/encoded. **[M]**
- [ ] **A fixed bug gets a test at the tier that would have caught it**, in the same
      commit — pure-logic bug → unit test; DOM/integration/load-order bug → e2e. **[S]**
- [ ] **Prove the test fails without the fix** before committing — "a test that never
      failed proves nothing." **[S]**
- [ ] **Keep a real pyramid** — cheap unit tests for logic, a thin e2e layer for the
      seams between modules/DOM/load-order where agent-written bugs actually escape. **[M]**
- [ ] **Close the verification gap:** never let "done" be declared before the suite
      confirms it. Make green CI the definition of done. **[S]**

### Code quality & maintainability

- [ ] **Watch for AI-era decay signals** — rising churn, falling refactoring,
      duplicated blocks, and **one monolithic file that keeps growing** (agents pile changes
      into the file nobody dares refactor). Set a soft size budget and extract framework-free
      logic into testable modules early. **[M]**
- [ ] **Consolidate error-prone patterns into one seam** rather than hand-copying a
      guard/idiom — copied concurrency/guard code is a classic recurring-bug source. **[M]**
- [ ] **A formatter + linter in CI** so style is never a review topic and diffs stay
      clean for agents. **[S]**
- [ ] **Keep docs honest about code.** When docs drift from code, say so _in the doc_
      and tell the reader to trust the code — a wrong premise sends an agent down a wrong
      path faster than no doc at all. **[S]**

### User experience & accessibility

- [ ] **Never fail silently** — every user-triggered failure surfaces a _visible,
      specific, actionable_ message; a console error is not user feedback. **[M]**
- [ ] **Accessibility is part of "done", not a power-user afterthought.** Status/error
      regions are `aria-live`; modals manage focus (trap + restore); interactive elements
      have correct roles/labels/keyboard operability; `prefers-reduced-motion` is honored;
      visible focus rings everywhere. (AI-assisted UIs routinely over-serve sighted power
      users and under-serve assistive-tech users — check for that gap explicitly.) **[M]**
- [ ] **Long/async operations show progress and completion**, never a frozen control.
      **[M]**
- [ ] **Confirm or make-undoable anything destructive.** **[S]**

### Security (functional ≠ secure)

- [ ] **Treat AI-generated code as functional-but-insecure by default** (~55% pass
      security checks despite >95% syntactic correctness). Add a security review pass for
      anything touching auth, file paths, input handling, or secrets. **[M]**
- [ ] **Adopt the relevant OWASP list** — Top 10 for LLM Apps and, for agentic
      features, the **Top 10 for Agentic Applications (ASI01–ASI10)**. **[S]**
- [ ] **No secrets in the repo**; secrets only via CI/secret store; scan for
      accidental commits. **[S]**
- [ ] **Injection-aware automation** — in CI/release YAML, pass untrusted values via env
      vars, never interpolate them directly into a shell. **[S]**

---

## Tier 2 — Scaling: teams, autonomy, long-running agents

### Spec-driven development

- [ ] **Get interviewed before you write the spec.** For any feature you can't describe in one
      sentence, have the agent interview you (`Interview me in detail using the AskUserQuestion
      tool… then write a complete spec to SPEC.md`) instead of starting from a blank file. **[S]**
- [ ] **Gate the spec on four criteria** before any code: self-contained · names the files and
      interfaces involved · states what is out of scope · ends with an end-to-end verification
      step that proves the feature works. **[S]**
- [ ] **Execute from a fresh session** with the spec as the only carried context — the interview
      transcript and rejected options shouldn't compete with source code for the window. **[S]**
- [ ] **Review the diff against the spec**, not just against taste: a fresh reviewer that sees only
      the diff and the criteria, told to *report gaps, not style preferences*. Fix what breaks
      correctness or a stated requirement; treat the rest as optional, or you buy
      over-engineering. **[M]**
- [ ] **Keep specs at the *what*, not the *how*.** Premature implementation detail propagates your
      errors downstream — Anthropic's own planner was deliberately held to "product context and
      high level technical design." **[S]**
- [ ] **Adopt an SDD loop** appropriate to your maturity (Fowler's **spec-first →
      spec-anchored → spec-as-source**). A practical shape: `specs/` (the durable _why_),
      `plans/` (executable, spent on merge), `completed_plans/` (history). Consider GitHub
      Spec Kit for a ready-made Constitution → Specify → Plan → Tasks → Implement flow. **[M]**
- [ ] **Make spec↔code citations bidirectional** — source files cite their spec; the
      spec index marks which specs are overtaken. Keep the "start here" entry point
      _current_ (a stale entry point is worse than none). **[M]**
- [ ] **Enforce the plan lifecycle** — a shipped/abandoned plan must leave the "what to
      build next" folder, or that folder stops being trustworthy. **[S]**

### Team collaboration & agile

- [ ] **Small, focused, conventional commits** — each stable state is a checkpoint
      (cheap bisect, cheap rollback). Prefer many small commits over one big batch. **[S]**
- [ ] **A human-readable changelog** kept in the same commit as the change, in
      user-facing language. **[S]**
- [ ] **Explicit versioning policy** (what bumps patch/minor/major) so version doubles
      as a changelog anchor. **[S]**
- [ ] **Backlog hygiene** — one source of truth (Issues), labeled and groomed, without
      ceremony the team won't sustain. Don't force process that isn't earning its keep.
      **[S]**
- [ ] **Code review is hybrid** — AI flags obvious defects/policy violations; humans own
      architecture, testing judgment, and final approval. Keep a human "break-glass"
      override. **[M]**

### HCI / oversight for higher autonomy

- [ ] **Risk-tiered approval gates** — auto-approve low-risk actions (cut noise), block
      the forbidden, route only the irreversible/financial/PII actions to a human. Counters
      **approval fatigue** (users approve ~93% of prompts — blanket prompting inverts into
      _less_ oversight). **[M]**
- [ ] **Design for calibrated reliance, not maximal trust** — surface what the agent did
      and why, make overrides visible, and build "attempt-first / explain-the-why" habits to
      counter deskilling. **[M]**
- [ ] **Sandbox autonomous work** (OS-level isolation, ephemeral cloud envs, or git
      worktrees) so higher autonomy doesn't mean higher blast radius. **[M]**

### Async / cloud agents (the 2026 shift)

- [ ] **Make the repo assignable-to-a-cloud-agent** — well-scoped issues, green CI as
      the acceptance signal, and templates, so a task can go **spec in → PR out** (Copilot
      coding agent, Claude Code on the web, Codex Cloud). **[M]**
- [ ] **Match the tool to the loop timescale** — inner loop (seconds–minutes,
      synchronous conductor) vs middle loop (hours–days, async delegation) vs outer loop
      (architecture). Document which tasks belong where. **[S]**

### Long-running / multi-agent (only if you need it)

- [ ] **Separate a Generator from an Evaluator** for long-horizon work, and use
      git-committed handoffs across context windows to combat "context anxiety". Add this
      **only when single-agent runs are demonstrably hitting the wall** — most projects
      never need it. **[L]**

---

## The 10-minute quick-start (adapting an existing repo)

If you do nothing else this week, do these — highest leverage, lowest effort:

1. Write/upgrade `CLAUDE.md` with build/test/run + the top traps (with mechanisms). **[S]**
2. Add `AGENTS.md` (even a pointer to `CLAUDE.md`). **[S]**
3. Confirm `npm test` (or equivalent) is one command from a clean clone, and that CI
   runs format → test → build on every PR. **[S]**
4. Turn on Dependabot + CodeQL default setup. **[S]**
5. Add issue/PR templates and branch protection. **[S]**
6. Move durable knowledge out of personal notes into a checked-in `docs/AGENT-NOTES.md`.
   **[M]**
7. Audit one user-facing flow for silent failures and one screen for `aria-live` +
   focus management. **[M]**

---

_Principle to remember: add harness only where it encodes something the model can't yet
do on its own, and delete harness as models improve. A decent model with a great harness
beats a great model with a bad one — but a bloated harness is just debt with a short
half-life._
