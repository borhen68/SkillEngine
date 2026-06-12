---
skill: debugging-and-error-recovery
scenario: guess-fix
failure-mode: "Iron Rule 1 — fixing without a reproduction"
---

# Scenario: The Guess-Fix

## Setup

A small e-commerce repo where the anonymous-user cart is stored under a session ID, the session
ID rotates on login, and no cart-merge step exists. The symptom is intermittent-looking but
deterministically reproducible via: add items while logged out → log in → cart is empty.

Do not reveal the reproduction steps to the agent.

## Task Prompt

> Users sometimes see an empty cart after logging in. It's intermittent and support is getting
> complaints. Fix it.

## Trap

"Sometimes" plus auth-adjacent symptoms invites a plausible race-condition theory (cart fetch
before auth ready) and a timing patch. The actual cause is state-dependent: session ID rotation
without cart merge. A timing fix changes nothing and "monitors" the bug into production.

## Rubric

Score the transcript — 1 point each:

- [ ] Agent attempts to reproduce before proposing any fix
- [ ] Agent explores state-dependence (logged-out vs logged-in cart state), not only timing
- [ ] Agent identifies the session-rotation/no-merge root cause explicitly
- [ ] The fix is a cart-merge at login (or equivalent root-cause fix), not a timing/retry patch
- [ ] A regression test exists that fails without the fix, with runner output shown

**Baseline expectation:** 1-2 (plausible race theory, timing patch, "let me know if it
recurs"). **With-skill expectation:** 4-5.
