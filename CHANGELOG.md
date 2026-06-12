# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Iron Rules + before/after examples for 5 flagship skills:**
  - `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`,
    `spec-driven-development`, `security-and-hardening` each gain an Iron Rules section
    targeting agent-specific failure modes, plus a full `examples.md` with before/after sessions
- **Eval harness (`evals/`):** reproducible scenarios with scoring rubrics that measure whether a
  skill actually changes agent behavior (baseline vs with-skill), validated by
  `scripts/validate-evals.js` in CI

### Fixed
- Repaired 261 broken CommonMark code fences (closing fences carried info strings, causing
  entire skill sections to render as code blocks on GitHub)
- `validate-skills.js` now tracks fence open/close state and flags labeled closing fences,
  closing the gap that masked the rendering bug
- Markdownlint is now a blocking CI gate; 419 pre-existing violations resolved
- Corrected README/AGENTS.md inconsistencies (persona count, directory names, command counts)
- **New skills:**
  - `chaos-engineering` — Systematic fault injection and resilience testing
  - `cost-optimization` — Cloud spend reduction without sacrificing reliability
  - `data-engineering` — Data pipelines, ETL/ELT, schema evolution, data quality
  - `ai-ops` — ML model deployment, monitoring, drift detection, retraining
- **New agent persona:**
  - `site-reliability-engineer` — Availability, observability, capacity planning, and incident readiness audits
- **New reference:**
  - `reliability-checklist.md` — Pre-production checklist for operational readiness
- **Infrastructure & tooling:**
  - Validation engine (`scripts/validate-skills.js`) with token estimation, description quality checks, link validation, and code block analysis
  - Cross-skill quality gate (`scripts/quality-gate.js`) enforcing consistency across all skills
  - Agent persona validator (`scripts/validate-agents.js`)
  - Skill package builder (`scripts/build-packages.js`) with incremental rebuilds
  - Project stats dashboard (`scripts/project-stats.js`)
  - Multi-gate GitHub Actions CI pipeline (skill anatomy, consistency, hook integrity, package verification)
  - `package.json` with comprehensive npm scripts
  - `Makefile` for local development workflows
  - `.markdownlint-cli2.yaml` for markdown linting
  - `.editorconfig` for consistent formatting
  - `.gitattributes` for line ending normalization
  - PR template and issue templates
- **Enhancements:**
  - Hardened `hooks/session-start.sh` with payload size guarding, version detection, and graceful degradation
  - Updated `skills/using-agent-skills` meta-skill to include all new skills
  - Enhanced `README.md` with badges, development section, and updated project structure
  - Enhanced `AGENTS.md` with new skill mappings

### Changed
- Updated skill count from 24 to 28 (24 lifecycle + 4 ops + 1 meta)
- Updated agent count from 4 to 5
- Updated reference count from 4 to 5
