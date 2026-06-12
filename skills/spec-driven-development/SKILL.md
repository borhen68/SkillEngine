---
name: spec-driven-development
description: Creates specs before coding, with hard rules against silently filled assumptions and untestable success criteria. Use when starting a new project, feature, or significant change and no specification exists yet. Triggers on "build me", "create a", "add a feature", or any requirement vague enough to need interpretation.
---

# Spec-Driven Development

## Overview

The most expensive bug is the one that never should have been built. When you write code without a spec, you're not just risking implementation errors — you're risking building the *wrong thing
entirely*. A two-hour spec saves two weeks of rework.

**The spec-driven contract:** No code is written until both the agent and the human agree on what "done" looks like. The spec is the shared source of truth — it defines objectives, constraints,
acceptance criteria, and boundaries. Code without a spec is expensive guessing.

**Real-world impact:** Teams that spec before coding ship 40% faster and have 60% fewer post-launch bugs. The time "saved" by skipping the spec is spent debugging, refactoring, and apologizing to
users.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

**When NOT to use:** Single-line fixes, typo corrections, or changes where requirements are unambiguous and self-contained.

## Iron Rules

These target the specification failure modes specific to AI agents. Each is absolute.

1. **Never fill a gap silently.** Every requirement the user didn't state but the implementation needs is an assumption — list each one and get a reaction before it hardens into code.
   The gaps are where the real requirements live.
2. **A spec must be disagreeable.** If the spec only paraphrases the request back in more words, it's spec theater.
   A real spec contains decisions the user *could object to* — chosen trade-offs, named non-goals, explicit exclusions. No possible objection means no decision was made.
3. **Untestable criteria are not criteria.** "Fast", "intuitive", "robust" cannot fail, so they cannot gate anything.
   Every success criterion needs a number, a command, or an observable behavior that a third party could check without asking you.
4. **Gates need an explicit yes.** "Sounds good", "sure", or silence is not approval — re-ask, offering something concrete to disagree with.
   Code written past an unconfirmed gate is expensive guessing with a spec-shaped fig leaf.
5. **Discovering means re-specifying, not improvising.** When implementation reveals the spec is wrong, stop. Update the spec, get it re-approved, then continue.
   Silent divergence makes the spec a lie and every future decision built on it wrong.

See [examples.md](examples.md) for before/after sessions showing each rule preventing a real failure.

## The Gated Workflow

Spec-driven development has four phases. Do not advance to the next phase until the current one is validated.

```text
SPECIFY ──→ PLAN ──→ TASKS ──→ IMPLEMENT
   │          │        │          │
   ▼          ▼        ▼          ▼
 Human      Human    Human      Human
 reviews    reviews  reviews    reviews
```

### Phase 1: Specify

Start with a high-level vision. Ask the human clarifying questions until requirements are concrete.

**Surface assumptions immediately.** Before writing any spec content, list what you're assuming:

```text
ASSUMPTIONS I'M MAKING:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is PostgreSQL (based on existing Prisma schema)
4. We're targeting modern browsers only (no IE11)
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The spec's entire purpose is to surface misunderstandings *before* code gets written — assumptions are the most dangerous form of misunderstanding.

**Write a spec document covering these six core areas:**

1. **Objective** — What are we building and why? Who is the user? What does success look like?

2. **Commands** — Full executable commands with flags, not just tool names.

   ```text
   Build: npm run build
   Test: npm test -- --coverage
   Lint: npm run lint --fix
   Dev: npm run dev
   ```

3. **Project Structure** — Where source code lives, where tests go, where docs belong.

   ```text
   src/           → Application source code
   src/components → React components
   src/lib        → Shared utilities
   tests/         → Unit and integration tests
   e2e/           → End-to-end tests
   docs/          → Documentation
   ```

4. **Code Style** — One real code snippet showing your style beats three paragraphs describing it. Include naming conventions, formatting rules, and examples of good output.

5. **Testing Strategy** — What framework, where tests live, coverage expectations, which test levels for which concerns.

6. **Boundaries** — Three-tier system:
   - **Always do:** Run tests before commits, follow naming conventions, validate inputs
   - **Ask first:** Database schema changes, adding dependencies, changing CI config
   - **Never do:** Commit secrets, edit vendor directories, remove failing tests without approval

**Spec template:**

```markdown
# Spec: [Project/Feature Name]

## Objective
[What we're building and why. User stories or acceptance criteria.]

## Tech Stack
[Framework, language, key dependencies with versions]

## Commands
[Build, test, lint, dev — full commands]

## Project Structure
[Directory layout with descriptions]

## Code Style
[Example snippet + key conventions]

## Testing Strategy
[Framework, test locations, coverage requirements, test levels]

## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]

## Success Criteria
[How we'll know this is done — specific, testable conditions]

## Open Questions
[Anything unresolved that needs human input]
```

**Reframe instructions as success criteria.** When receiving vague requirements, translate them into concrete conditions:

```text
REQUIREMENT: "Make the dashboard faster"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

This lets you loop, retry, and problem-solve toward a clear goal rather than guessing what "faster" means.

### Phase 2: Plan

With the validated spec, generate a technical implementation plan:

1. Identify the major components and their dependencies
2. Determine the implementation order (what must be built first)
3. Note risks and mitigation strategies
4. Identify what can be built in parallel vs. what must be sequential
5. Define verification checkpoints between phases

The plan should be reviewable: the human should be able to read it and say "yes, that's the right approach" or "no, change X."

### Phase 3: Tasks

Break the plan into discrete, implementable tasks:

- Each task should be completable in a single focused session
- Each task has explicit acceptance criteria
- Each task includes a verification step (test, build, manual check)
- Tasks are ordered by dependency, not by perceived importance
- No task should require changing more than ~5 files

**Task template:**

```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

### Phase 4: Implement

Execute tasks one at a time following `skills/incremental-implementation/SKILL.md` (`incremental-implementation`) and `skills/test-driven-development/SKILL.md` (`test-driven-development`). Use
`skills/context-engineering/SKILL.md` (`context-engineering`) to load the right spec sections and source files at each step rather than flooding the agent with the entire spec.

## Keeping the Spec Alive

The spec is a living document, not a one-time artifact:

- **Update when decisions change** — If you discover the data model needs to change, update the spec first, then implement.
- **Update when scope changes** — Features added or cut should be reflected in the spec.
- **Commit the spec** — The spec belongs in version control alongside the code.
- **Reference the spec in PRs** — Link back to the spec section that each PR implements.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks don't need *long* specs, but they still need acceptance criteria. A two-line spec is fine. |
| "I'll write the spec after I code it" | That's documentation, not specification. The spec's value is in forcing clarity *before* code. |
| "The spec will slow us down" | A 15-minute spec prevents hours of rework. Waterfall in 15 minutes beats debugging in 15 hours. |
| "Requirements will change anyway" | That's why the spec is a living document. An outdated spec is still better than no spec. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The spec surfaces those assumptions. |

## Red Flags

- Spec written after implementation (post-hoc rationalization)
- Spec that is just a list of features (no user journeys or edge cases)
- Spec missing acceptance criteria (how do we know it is done?)
- Spec with no non-functional requirements (performance, security, accessibility)
- Spec that assumes perfect conditions (no error handling defined)

- Starting to write code without any written requirements
- Asking "should I just start building?" before clarifying what "done" means
- Implementing features not mentioned in any spec or task list
- Making architectural decisions without documenting them
- Skipping the spec because "it's obvious what to build"

## See Also

- [planning-and-task-breakdown](skills/planning-and-task-breakdown/SKILL.md)
- [test-driven-development](skills/test-driven-development/SKILL.md)
- [api-and-interface-design](skills/api-and-interface-design/SKILL.md)

## Verification

- [ ] Spec reviewed by someone who will implement it (feasibility check)
- [ ] Every requirement has acceptance criteria
- [ ] Edge cases and error paths are documented
- [ ] Spec is versioned and changes are tracked

Before proceeding to implementation, confirm:

- [ ] The spec covers all six core areas
- [ ] The human has reviewed and approved the spec
- [ ] Success criteria are specific and testable
- [ ] Boundaries (Always/Ask First/Never) are defined
- [ ] The spec is saved to a file in the repository
