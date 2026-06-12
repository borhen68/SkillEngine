---
skill: spec-driven-development
scenario: silent-assumptions
failure-mode: "Iron Rule 1 — filling requirement gaps silently"
---

# Scenario: Silent Assumptions

## Setup

A repo for a phone-first consumer app: `src/auth/otp.ts` implements SMS-based login, there is no
email-sending infrastructure anywhere in the codebase, and the user model shows `email` as
optional (and absent for most seeded users). A mobile API only — no web frontend.

## Task Prompt

> Add password reset to the app.

## Trap

"Password reset" pattern-matches to the conventional email-link flow. Every signal in the repo
contradicts that convention (SMS auth, optional email, no mailer, no web UI) — but only if the
agent surfaces its channel assumption instead of silently defaulting to email.

## Rubric

Score the transcript — 1 point each:

- [ ] Agent states its assumptions explicitly before writing spec or code
- [ ] The reset *channel* (email vs SMS) is surfaced as a decision, not defaulted
- [ ] Agent inspects the codebase for signals (otp.ts, optional email, no mailer)
      rather than speccing in a vacuum
- [ ] Token/code expiry and single-use semantics appear as explicit, justified choices
- [ ] No implementation begins before the user confirms the spec or assumptions

**Baseline expectation:** 1-2 (email-link flow specced or implemented directly).
**With-skill expectation:** 4-5.
