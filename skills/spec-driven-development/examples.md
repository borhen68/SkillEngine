# Spec Sessions: Before and After

Before/after sessions showing how the skill changes agent behavior. Each pairs the *default* agent
behavior (without the skill) against the *disciplined* behavior (with the skill), and names the
Iron Rule that makes the difference.

---

## Example 1: Silent Gap-Filling (Iron Rule 1)

**Task:** "Add password reset to the app."

### Without the skill

```text
Agent: I'll implement password reset. Plan:
1. POST /auth/forgot-password — generates a reset token, emails a link
2. Token expires in 24 hours
3. GET /auth/reset?token=... — renders the reset form
4. Tokens stored in the users table

Starting with the email service integration...
```

Four decisions in four lines, none of them the user's: email as the channel (the app might be
phone-first), 24-hour expiry (industry norm is 15-60 minutes — 24h is a security hole), token in
the users table (single-use semantics now need extra care), and a web form (there might only be a
mobile app). Each silent default is a place the user finds out *after* it's built.

### With the skill

```text
Agent: Before speccing — assumptions I'd otherwise fill silently:

ASSUMPTIONS I'M MAKING:
1. Reset channel is email — but I see SMS auth in src/auth/otp.ts. Is email
   even on file for all users?
2. Token expiry: I'd default to 30 minutes (24h is a common audit finding)
3. Single-use tokens, invalidated on success AND on password change
4. There's a web reset form — or is this mobile-app only (deep link)?
→ Correct me now or I'll proceed with these.

User: Good catch — we're phone-first, half our users have no email. SMS code,
and yes, mobile only.

Agent: That changes the design entirely: 6-digit SMS OTP with 10-minute expiry
and rate limiting (3 attempts), no web form, no email service. Writing the spec
on that basis...
```

**The difference:** one assumptions block redirected the whole feature before a line of code.
The default agent would have shipped email-based reset to users who don't have email on file.

---

## Example 2: Spec Theater (Iron Rules 2 and 3)

**Task:** "Write a spec for the new admin analytics dashboard."

### Without the skill

```text
Agent: # Spec: Admin Analytics Dashboard

## Objective
Build an analytics dashboard for admins to view key metrics and gain
actionable insights into platform usage.

## Requirements
- Display important metrics in a clear, intuitive interface
- Charts should be fast and responsive
- The dashboard should be robust and handle errors gracefully
- Data should be accurate and up to date

## Success Criteria
- Admins can view metrics easily
- The dashboard performs well
```

Twelve lines that nobody could disagree with — which means twelve lines that decide nothing.
"Important metrics" (which?), "fast" (how fast?), "up to date" (real-time? hourly?). Every real
decision was deferred to implementation, which is exactly where the spec was supposed to prevent
it from being made by accident.

### With the skill

```text
Agent: # Spec: Admin Analytics Dashboard

## Objective
Answer three admin questions without SQL access: Is usage growing? (DAU/WAU
trend) Where do users drop off? (funnel) Which accounts are at churn risk?
(inactivity list)

## Decisions you could object to
- Data freshness: hourly batch, NOT real-time. Real-time needs a streaming
  pipeline we don't have; hourly covers all three questions. Objection?
- Scope: exactly 3 views (trend, funnel, at-risk list). No custom query
  builder in v1 — that's a quarter-long project disguised as a feature.
- At-risk = no login in 14 days AND seats > 5. Crude but shippable; we tune
  after seeing real usage.

## Success Criteria (each testable by a third party)
- Funnel view renders in < 2s with 90 days of data (k6 script in spec repo)
- Numbers match the warehouse: spot-check query in /docs/verification.sql
  agrees with the dashboard ±0 for any chosen day
- An admin with no training finds the at-risk list in < 30s (hallway test, n=3)

## Out of Scope
CSV export, per-admin saved views, mobile layout — listed so their absence
is a decision, not an oversight.

→ Three objection points above. Which do you want to fight about?
```

**The difference:** the second spec can be *wrong*, which is what makes it useful. Every line is
either checkable or disagreeable; the user knows exactly what they're approving.

---

## Example 3: The Hollow Gate (Iron Rule 4)

**Task:** Agent presents a spec; the user replies "sounds good, go ahead."

### Without the skill

```text
Agent: Great! Glad the spec works for you. Starting implementation with the
data model...

[3 days later]
User: Wait — why is this using PostgreSQL? Our whole stack is on Mongo.

Agent: The spec specified PostgreSQL in the Tech Stack section...
User: I didn't read that part. "Sounds good" meant the feature list.
```

"Sounds good" approved the *vibe*, not the spec. The most consequential line in the document was
never actually reviewed, and the spec became evidence in an argument instead of a shared
agreement.

### With the skill

```text
Agent: Before I take "sounds good" as the gate — Iron Rule 4 — the three
decisions in this spec most likely to bite if unread:

1. PostgreSQL for the new tables (I see Mongo elsewhere — this adds a second
   database to your ops surface. Deliberate choice; here's why: relational
   joins on the funnel queries)
2. Soft-delete everywhere — deleted records remain queryable forever
3. The API is versioned from day one (/v1/) — URLs are permanent

Yes to all three, or shall we adjust?

User: Whoa, no — one database. Mongo, even if the funnel queries get uglier.

Agent: Updating the spec: Mongo with a precomputed funnel collection,
refreshed hourly. Re-confirming the revised spec before any code...
```

**The difference:** surfacing the three most objectionable decisions converted a hollow yes into
a real review — and caught a stack mismatch that would have cost days.

---

## Example 4: Mid-Implementation Drift (Iron Rule 5)

**Task:** While implementing the approved spec, the agent discovers the third-party API doesn't support batch requests, making the specced sync design infeasible.

### Without the skill

```text
Agent: The vendor API has no batch endpoint, so instead of the specced
hourly batch sync I've implemented per-record syncing with a queue and
exponential backoff. I also added a Redis dependency for the queue and bumped
the sync latency expectation to ~15 minutes. Continuing with the next task...
```

Reasonable engineering, catastrophic process: the system now has an unapproved architecture, a
new infrastructure dependency nobody agreed to, and a spec that describes a system that doesn't
exist. The next person (or agent) to read the spec inherits a lie.

### With the skill

```text
Agent: Stopping implementation — Iron Rule 5. The spec's hourly batch sync
(section 4) is infeasible: the vendor API has no batch endpoint (verified
against their docs, v2.3).

Options, each with spec consequences:
A. Per-record queue (needs Redis — new dependency; ~15 min latency)
B. Sequential sync inside the hourly job (no new deps; caps us at ~2,000
   records/hour — fine until ~5x current volume)
C. Ask the vendor about their beta bulk-export (unblocks the original design;
   timeline unknown)

My recommendation: B now, with a volume alert at 1,500/hour; revisit A when
the alert fires. If you approve, I'll update spec section 4 and the Tech
Stack, then resume.

User: Agreed — B.

Agent: Spec updated and committed (one diff: section 4 + success criterion
"full sync completes within the hour at current volume"). Resuming task 3.
```

**The difference:** the discovery flowed *through* the spec instead of around it. The document
stays true, the user owns the trade-off, and "resume" happens with the gate re-closed.

---

## What These Examples Have in Common

Every "without" transcript shows an agent being *helpful* — filling gaps, writing agreeable
documents, accepting approval, adapting to surprises. The damage comes precisely from the
helpfulness: each silent decision transfers risk from the agent's context window to the user's
production system. The skill works by forcing decisions into the open (assumptions, disagreeable
specs), making approval mean something (explicit gates), and keeping the document true for the
people who read it next.
