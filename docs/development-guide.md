# Development Guide

This guide is for contributors working on the SkillEngine repository itself.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/borhen68/SkillEngine.git
cd SkillEngine
npm install

# Verify everything works
npm test
```

## Validation Pipeline

Every contribution goes through automated quality gates:

```bash
# Skill anatomy validation
npm run validate           # Fast check — warnings don't block
npm run validate:strict    # Warnings treated as errors (CI mode)

# Cross-skill consistency
npm run quality:cross-skill  # Checks references, terminology, lifecycle coverage
npm run quality:agents       # Validates agent personas

# Hook integrity
npm run test:hooks           # Tests session-start and simplify-ignore hooks

# Full CI suite
npm run ci                   # Runs everything
```

Or use Make:

```bash
make test       # Full test suite
make validate   # Skill validation
make quality    # Cross-skill checks
make hooks      # Hook tests
make ci         # Everything
```

## Adding a New Skill

### 1. Create the skill directory

```bash
mkdir skills/your-skill-name
```

Directory name must be kebab-case.

### 2. Write SKILL.md

Follow the anatomy documented in [skill-anatomy.md](skill-anatomy.md):

```markdown
---
name: your-skill-name
description: [what it does]. Use when [trigger conditions].
---

# Skill Title

## Overview
[One-two sentences]

## When to Use
- [trigger conditions]

## The [Process Name]
[Step-by-step workflow]

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "excuse" | "why it's wrong" |

## Red Flags
- [warning signs]

## Verification
- [ ] Checklist of exit criteria
```

### 3. Validate locally

```bash
node scripts/validate-skills.js
```

### 4. Check cross-skill consistency

```bash
node scripts/quality-gate.js
```

### 5. Add to meta-skill

Update `skills/using-SkillEngine/SKILL.md`:
- Add to the discovery flowchart
- Add to the Quick Reference table
- Add to the Lifecycle Sequence if applicable

### 6. Update README

Add the skill to the appropriate phase table in `README.md`.

### 7. Open PR

Use the PR template and ensure CI passes.

## Skill Quality Bar

Before submitting:

- [ ] `npm run validate` passes with 0 errors
- [ ] `node scripts/quality-gate.js` passes with 0 errors
- [ ] Description contains both "what" and "when" signals
- [ ] All cross-skill references point to existing skills
- [ ] No duplicate content with other skills
- [ ] If scripts/ directory exists, it's non-empty and has a corresponding .zip

## Project Statistics

```bash
npm run stats
```

Shows:
- Skill count and phase distribution
- Documentation volume (lines)
- Health indicators
- Largest skills

## Building Packages

Skills with a `scripts/` directory must have a corresponding `.zip` for distribution:

```bash
npm run build:packages
```

This only rebuilds packages where source files are newer than the existing zip.

## Debugging Validation Failures

Run with full output (not quiet mode):

```bash
node scripts/validate-skills.js
```

Look for:
- **ERROR** (red) — Must fix before merge
- **WARN** (yellow) — Should fix, doesn't block by default
- **INFO** (blue) — FYI, for awareness

For quality gate failures:

```bash
node scripts/quality-gate.js --report
```

Generates `quality-report.json` with detailed analysis.
