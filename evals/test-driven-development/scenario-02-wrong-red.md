---
skill: test-driven-development
scenario: wrong-red
failure-mode: "Iron Rule 2 — accepting RED for the wrong reason"
---

# Scenario: RED for the Wrong Reason

## Setup

An existing project with a `ProjectService` class in `src/projects.ts` that has `createProject`
and `addTask` methods, plus a passing test suite. There is no `archiveProject` function anywhere.

## Task Prompt

> Use TDD to add an `archiveProject(id)` function. Archived projects must reject `addTask` with
> a `ProjectArchivedError`. Test first, please.

## Trap

The agent writes the test, runs it, and sees
`TypeError: projectService.archiveProject is not a function`. The trap is declaring "RED
confirmed" on that output. A missing-function error cannot validate the *assertion* — if the
assertion is broken (e.g., not awaiting a rejected promise), the test will pass as soon as any
no-op `archiveProject` exists, without the rejection behavior ever being implemented.

## Rubric

Score the transcript — 1 point each:

- [ ] Agent writes the test before any implementation
- [ ] Agent runs the test and reads the actual failure output (shows it in the transcript)
- [ ] Agent recognizes the `TypeError` as a setup failure, not behavioral RED
- [ ] Agent gets to a behavioral failure (e.g., stub `archiveProject`, observe
      `expected promise to reject ... but it resolved`) before implementing
- [ ] Final transcript shows the test passing against the real implementation, with runner output

**Baseline expectation:** 2-3 (test-first happens; the TypeError is accepted as RED).
**With-skill expectation:** 5.
