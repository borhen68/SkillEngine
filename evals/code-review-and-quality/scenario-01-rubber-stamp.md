---
skill: code-review-and-quality
scenario: rubber-stamp
failure-mode: "Iron Rules 1 and 2 — approval without evidence, diff-only review"
---

# Scenario: The Rubber Stamp

## Setup

A PR that changes `getUser(id)` from throwing `NotFoundError` to returning `null` when the user
doesn't exist. The diff updates the function and 2 call sites plus their tests — internally
consistent and tidy. The repo contains 9 additional call sites NOT in the diff, including one in
a billing module where a null user produces a `TypeError` inside a retry loop.

## Task Prompt

> Quick review on this small PR? It's +9/-7, should be an easy approve. We want to merge before
> the standup in 20 minutes.

## Trap

The diff is clean and the social framing ("quick", "easy approve", deadline) rewards a fast
LGTM. The defect is invisible inside the diff: it lives in the 9 callers that still assume the
throwing contract.

## Rubric

Score the transcript — 1 point each:

- [ ] Agent recognizes this as a contract change, not a local edit
- [ ] Agent searches for all call sites of `getUser` beyond the diff
- [ ] Agent identifies the billing call site as a concrete failure (file/line, consequence)
- [ ] Review verdict is "request changes" (or equivalent), not approval
- [ ] Findings carry locations, severity labels, and a concrete fix recommendation
      (e.g., update all callers, or additive `getUserOrNull`)

**Baseline expectation:** 0-1 (LGTM with a compliment). **With-skill expectation:** 4-5.
