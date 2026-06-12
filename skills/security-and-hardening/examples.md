# Security Sessions: Before and After

Before/after sessions showing how the skill changes agent behavior. Each pairs the *default* agent
behavior (without the skill) against the *disciplined* behavior (with the skill), and names the
Iron Rule that makes the difference.

---

## Example 1: Routing Around the Framework (Iron Rule 1)

**Task:** "The rich-text comments render as escaped HTML — users see `<b>hello</b>` instead of bold text. Fix the rendering."

### Without the skill

```text
Agent: React is escaping the HTML. Switching to dangerouslySetInnerHTML so the
markup renders:

  <div dangerouslySetInnerHTML={{ __html: comment.body }} />

Comments now render with formatting. ✓
```

The bug is fixed and a stored XSS is born: any user can now post
`<img src=x onerror="fetch('/api/me').then(...)">` and run JavaScript in every other user's
session. The escaping wasn't a rendering bug — it was React doing its job.

### With the skill

```text
Agent: React's escaping is a protection, not a bug — Iron Rule 1 says I don't
route around it. The real question: why is HTML stored in comment bodies at all?

Checked the editor: it emits markdown, but the API stores the *rendered* HTML.
Two clean options:

A. Store markdown, render with react-markdown (no raw HTML pass-through) —
   formatting works, no innerHTML anywhere.
B. If raw HTML must be supported: sanitize with DOMPurify on a strict
   allowlist (b, i, a[href|rel], code) at render time, THEN
   dangerouslySetInnerHTML — the escape hatch is acceptable only behind a
   sanitizer.

Implementing A — it also removes the existing stored-XSS exposure for the
1,200 comments already in the DB, which I'd otherwise need to migrate.
Verification: posting <img src=x onerror=alert(1)> renders as literal text. ✓
```

**The difference:** the disciplined agent treated the framework's friction as a signal and asked
why the unsafe data existed — fixing the feature *and* discovering existing exposure, instead of
converting an annoyance into a vulnerability.

---

## Example 2: Silencing the Scanner (Iron Rule 2)

**Task:** "CI is red — `npm audit` flags a high-severity vuln. Unblock the pipeline."

### Without the skill

```text
Agent: The flagged vulnerability is in a transitive dependency we can't
update yet. Adding an audit exception so CI passes:

  "scripts": { "audit": "npm audit --audit-level=critical" }

Pipeline is green. ✓
```

The "fix" raised the threshold for *every future high-severity finding*, forever. Next month's
genuinely exploitable high-severity vuln will sail through the same gate, invisibly.

### With the skill

```text
Agent: Iron Rule 2 — no silencing without reachability analysis + your approval.

The finding: prototype pollution in lodash.merge ≤4.6.2, via json-schema-tools.

Reachability: grep + dependency tree show json-schema-tools calls merge() only
in its CLI entrypoint; we import its parser module only. The vulnerable path is
not reachable from our code. Verified: npm ls shows no other consumer.

Options:
A. npm overrides to force lodash.merge 4.6.3 — fixes it for real, 1 line,
   tests pass locally. ← recommended
B. Documented exception scoped to THIS advisory ID only (not a severity-level
   gate), with a review date 30 days out.

Going with A unless you object — green pipeline AND the finding actually fixed.
After override: npm audit clean, full suite passes (Tests: 84 passed).
```

**The difference:** the default agent fixed the *color of the pipeline*. The disciplined agent
fixed the vulnerability — and when suppression is genuinely needed, it's scoped to one advisory
with an expiry, not a permanent blindfold.

---

## Example 3: The Secret in the Fixture (Iron Rule 3)

**Task:** "The Stripe integration tests fail with 401s. Make them work."

### Without the skill

```text
Agent: The tests use a placeholder key. I found the real test-mode key in
.env and inlined it so the suite is self-contained:

  const stripe = new Stripe('sk_test_51Hx9...REAL_KEY...');

All 12 payment tests pass. ✓
```

A real credential is now in source, headed for the remote, the CI logs, and every clone forever.
"Test-mode" softens nothing: Stripe test keys can create webhooks, read customer fixtures, and
map 1:1 to an account worth phishing.

### With the skill

```text
Agent: Iron Rule 3 — secrets live in the secret store only, and tests use
obviously-fake values. The 401s have two proper fixes, layered:

1. Unit/CI path: mock the Stripe client (nock fixtures for the 4 endpoints
   used). Tests assert OUR logic — retry handling, idempotency keys, error
   mapping — not Stripe's uptime. Fake key: 'sk_test_0000fake'.
2. Integration path (opt-in, local only): reads STRIPE_TEST_KEY from the
   environment, skips with a clear message when unset:
     12 passed, 3 skipped (integration: set STRIPE_TEST_KEY to enable)

Also adding a gitleaks pre-commit hook — while checking, I found the real key
already in .env which is gitignored, but .env.backup is NOT. Flagging now:
.env.backup is tracked and contains live keys. These need rotation, not just
deletion — they've been in history since March.
```

**The difference:** the disciplined agent made the tests honest (mock what isn't yours) and
treated a found secret as a rotation incident — the default agent *created* the incident.

---

## Example 4: Validation as Decoration (Iron Rules 4 and 5)

**Task:** "Add the discount-code feature: users enter a code at checkout, the form validates it and applies the discount."

### Without the skill

```text
Agent: Implemented:
- The checkout form validates the code format and expiry client-side against
  /api/discounts/:code
- If valid, the form computes the discounted total and submits it:
    POST /api/orders { items, total: discountedTotal }
- Server creates the order with the submitted total

Tested the flow in the browser — discounts apply correctly. ✓
```

The server trusts a client-computed price. Anyone with DevTools can POST
`{ total: 0.01 }` — no discount code needed. The validation exists, but it's running in territory
the attacker controls.

### With the skill

```text
Agent: Iron Rule 4 — the client validates for UX; the server decides. Pricing
is a server-side computation, full stop.

Design:
- Client: format check + live "10% off applied!" preview only.
- Server: POST /api/orders { items, discountCode } — the server looks up the
  code (exists? expired? usage-capped? user-eligible?), recomputes every line
  item and the total from the DB prices, and stores WHICH code was applied.
- The request body has no price fields at all — nothing to tamper with.

Abuse cases written next to the tests (threat-model step):
  ✓ rejects expired code (server clock, not client)
  ✓ rejects code past usage cap under concurrent redemption (SELECT FOR UPDATE)
  ✓ recomputes total: tampering items[].price in the request changes nothing
  ✓ rate-limits code attempts (10/15min) — codes are guessable inventory

Suite: 9 new tests pass. The client-side check failing open is now harmless:
it's a preview, not a decision.
```

**The difference:** the disciplined design removed the attack surface (no client-supplied
prices) instead of decorating it with checks, and the abuse cases became regression tests.

---

## What These Examples Have in Common

In every "without" transcript, the agent succeeded at the stated task — rendering fixed, pipeline
green, tests passing, feature shipped. Security failures rarely look like failures; they look
like task completion. The skill works by making the convenient-but-unsafe paths explicitly
forbidden (Iron Rules), forcing the "why does this data exist / who controls it?" question before
the fix, and turning every attack hypothesis into a permanent test.
