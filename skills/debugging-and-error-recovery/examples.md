# Debugging Sessions: Before and After

Before/after sessions showing how the skill changes agent behavior. Each pairs the *default* agent
behavior (without the skill) against the *disciplined* behavior (with the skill), and names the
Iron Rule that makes the difference.

---

## Example 1: The Guess-Fix (Iron Rule 1)

**Task:** "Users sometimes see an empty cart after logging in. Fix it."

### Without the skill

```text
Agent: This is almost certainly a session race — the cart loads before auth
completes. I'll make the cart fetch wait for the auth state:

  const cart = await authReady.then(() => fetchCart(userId));

That should resolve the issue. Let me know if it happens again!
```

No reproduction, so no way to know if the diagnosis is right. If the real cause is the cart being
keyed to an anonymous session ID that rotates at login, this fix changes nothing — and "let me
know if it happens again" outsources verification to production users.

### With the skill

```text
Agent: Iron Rule 1 — no fix before a reproduction. "Sometimes" suggests
state- or timing-dependence. Trying the state-dependent path first: does it
reproduce when items were added *before* logging in?

  1. Add 2 items as anonymous user
  2. Log in
  3. Cart renders empty — reproduced, deterministically.

Not a race: the anonymous cart is stored under a session ID that rotates at
login, and no merge happens. Minimal repro confirms it: the fix is a cart-merge
step in the login flow, not a timing patch.

After fix — original repro steps now show both items post-login. Regression
test added: 'merges anonymous cart into account cart at login'.
```

**The difference:** the reproduction *falsified* the plausible-sounding race theory before any
code changed. The default agent would have shipped a timing patch for a keying bug.

---

## Example 2: Shotgun Debugging (Iron Rule 2)

**Task:** "The image upload test started failing on CI. Make it pass."

### Without the skill

```text
Agent: Several things could cause this. I've made the following changes:

  - Bumped the test timeout from 5s to 30s
  - Pinned sharp to the previous minor version
  - Added a retry around the S3 mock setup
  - Increased CI runner memory in the workflow

The test passes now. ✓
```

Four changes, one green run. Which one fixed it? Unknown. Three of them are now permanent cargo
cult — and if the real cause was the sharp version, the timeout bump and retry will hide the
*next* real failure too.

### With the skill

```text
Agent: Iron Rule 2 — one variable at a time. First, establish when it broke:

  git bisect start; git bisect bad; git bisect good HEAD~20
  → bisect lands on "chore: update dependencies" (sharp 0.32 → 0.33)

Testing that single variable: pin sharp back to 0.32 on its own — test passes.
Re-apply 0.33 — test fails with ERR_DLOPEN: missing libvips symbol.

Root cause: sharp 0.33 requires a newer libvips than the CI image provides.
Fix is one change: update the CI base image (keeping sharp current). Timeout,
retries, and memory stay untouched — they were never implicated.
```

**The difference:** bisection plus single-variable testing produced one explainable fix instead
of four superstitions.

---

## Example 3: Suppressing the Signal (Iron Rule 3)

**Task:** "The nightly report job crashes with `TypeError: Cannot read properties of null (reading 'email')`. Stop the crashes."

### Without the skill

```text
Agent: I'll make the job resilient so one bad record can't take it down:

  try {
    sendReport(user.email);
  } catch (e) {
    // skip malformed users
    continue;
  }

The job now completes without crashing. ✓
```

The crash is gone — and so is the signal. Users with null emails now silently receive no report,
forever. Nobody will know until a customer complains, and by then the try/catch will hide where
and why.

### With the skill

```text
Agent: Iron Rule 3 — the crash is a signal, not the problem. Why is email null?

  SELECT COUNT(*) FROM users WHERE email IS NULL;  → 47 rows
  All 47 created between June 3-5 — exactly the window of the OAuth-signup
  incident in the changelog, which created accounts before profile completion.

Root cause: incomplete accounts from a known incident, plus a schema that
permits NULL email for a column the app treats as required.

Fix (three parts, each justified):
  1. Backfill: prompt the 47 users to complete signup (data fix)
  2. Constraint: NOT NULL on email after backfill (prevent recurrence)
  3. The job skips-and-logs incomplete accounts with a count metric —
     skipping is now a *decision with visibility*, not silent suppression.
```

**The difference:** the disciplined agent asked what the crash was telling them. The default
agent told the crash to be quiet.

---

## Example 4: "It Works Now" (Iron Rules 4 and 5)

**Task:** "The flaky `checkout total` test passed after I touched the fixture. Are we done?"

### Without the skill

```text
Agent: I re-ordered the fixture setup and the test has passed 3 times in a row.
Whatever it was, it's resolved now. Moving on. ✓
```

A flaky test passing three times is indistinguishable from luck. "Whatever it was" means the
cause is unknown, which means it will be back — in this test or another one.

### With the skill

```text
Agent: Iron Rule 4 — I can't explain why reordering the fixture mattered, so
this isn't fixed. Proving causality: reverting my reorder... 14 runs: 11 pass,
3 fail. Failure returns — the reorder was masking, not fixing.

Investigating the failing runs: the test asserts on checkout totals computed
from `new Date()` — it fails when the run crosses a minute boundary during a
discount-window check. Time-dependence, not fixture order.

Fix: inject a fixed clock into the discount logic; assert against it.
Iron Rule 5 — re-running the original failing command 50 times: 50/50 pass.
Reverting the clock injection: failures return. Causality proven both ways.
```

**The difference:** revert-and-confirm turned "it seems fine now" into a proven mechanism: known
cause, fix that fails without it, evidence in both directions.

---

## What These Examples Have in Common

Every "without" transcript ends in apparent success — green tests, no crashes, a confident
summary. That's what makes these failure modes dangerous: they *look* like competence. The skill
works by refusing the shortcuts that produce false green (Iron Rules), forcing the sequence that
produces knowledge (reproduce → localize → reduce → fix → guard), and demanding causal evidence
at the exit — not just the absence of visible failure.
