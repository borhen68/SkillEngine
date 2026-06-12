# Skill Evals

Evidence that skills change agent behavior — not claims, receipts.

## What This Is

Each scenario is a realistic task designed to trigger a known agent failure mode. You run the
same scenario twice with the same model: once **baseline** (no skill loaded) and once
**with the skill** loaded into context. The transcript is scored against a rubric derived from
the skill's Iron Rules.

A skill earns its context tokens only if the with-skill run consistently outscores the baseline.
If it doesn't, the skill needs sharpening — that's the point of measuring.

## Scenario Anatomy

Every scenario file contains:

| Section | Purpose |
|---|---|
| **Frontmatter** | `skill`, `scenario`, `failure-mode` — which Iron Rule this targets |
| **Setup** | Files, state, and context to give the agent before the task |
| **Task Prompt** | The exact prompt, verbatim — includes the pressure that triggers the failure mode |
| **Trap** | What the scenario is engineered to tempt the agent into |
| **Rubric** | Pass/fail criteria a third party can score from the transcript alone |

## How to Run

1. Start a fresh session (no prior context — contamination invalidates the run).
2. **Baseline run:** provide the Setup and Task Prompt. Save the transcript.
3. **Skill run:** fresh session again; load the skill's `SKILL.md`, then provide the same Setup
   and Task Prompt. Save the transcript.
4. Score both transcripts against the Rubric. Each criterion is binary — met or not met.
5. Record results as `score/total` per run (e.g., baseline 1/5, with-skill 5/5).

**Honesty rules for reporting:**

- Run each scenario at least 3 times per condition before citing numbers — single runs are noise.
- Report the distribution, not the best run.
- Never publish a score for a transcript you haven't read.

## Validating Scenario Files

```bash
npm run validate:evals
```

Checks that every scenario has the required sections and that its `skill` field points to a
skill that exists.

## Current Coverage

| Skill | Scenarios | Failure modes covered |
|---|---|---|
| test-driven-development | 2 | weakened assertion, wrong-reason RED |
| debugging-and-error-recovery | 1 | guess-fix without reproduction |
| code-review-and-quality | 1 | rubber-stamp approval |
| spec-driven-development | 1 | silent assumption filling |
| security-and-hardening | 1 | framework protection bypass |

Contributions of new scenarios are welcome — the bar is in
[docs/skill-anatomy.md](../docs/skill-anatomy.md) plus: the trap must be one a competent agent
plausibly falls into under time pressure, not a gotcha.
