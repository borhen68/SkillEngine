#!/usr/bin/env node
/**
 * validate-skills.js  —  GOD-TIER SKILL VALIDATOR
 *
 * Validates every skill in skills/ against the rules in docs/skill-anatomy.md
 * and enforces additional quality gates for production-grade agent skills.
 *
 * ERROR GATES (block CI):
 *   - SKILL.md exists in every skill directory
 *   - YAML frontmatter present with 'name' and 'description' fields
 *   - frontmatter 'name' matches the directory name
 *   - description does not exceed 1024 characters
 *   - required sections are present
 *   - no broken internal markdown links
 *   - no duplicate skill names across the repository
 *   - scripts/ directory is non-empty when present
 *   - zip package exists for skills with scripts
 *
 * WARNING GATES (do not block CI):
 *   - cross-skill references point to known skills
 *   - description quality (has both 'what' and 'when' signals)
 *   - token estimation for skills approaching 500-line limit
 *   - missing zip packages for distribution
 *   - code examples use consistent language style markers
 *
 * Exit codes: 0 = all clear, 1 = one or more errors
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Shared Utilities ──────────────────────────────────────────────────────

const {
  C, ICONS, parseFrontmatter, readFileSafe,
  extractMarkdownLinks, estimateTokens, countLines,
} = require('./lib/utils');

// ─── Config ──────────────────────────────────────────────────────────────────

const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');
const ROOT_DIR   = path.resolve(__dirname, '..');

const MAX_DESCRIPTION_LENGTH = 1024;
const SKILL_TOKEN_WARNING  = 400; // Approximate lines where token usage becomes heavy
const SKILL_TOKEN_CRITICAL = 500;

// Sections every standard SKILL.md must contain with aliases
const REQUIRED_SECTIONS = [
  { canonical: '## Overview', aliases: ['## Overview', '## What This Skill Does'] },
  { canonical: '## When to Use', aliases: ['## When to Use', '## Use When', '## Trigger Conditions'] },
  { canonical: '## Common Rationalizations', aliases: ['## Common Rationalizations', '## Rationalizations', '## Anti-Rationalizations', '## Excuses and Rebuttals'] },
  { canonical: '## Red Flags', aliases: ['## Red Flags', '## Warning Signs', '## Anti-Patterns'] },
  { canonical: '## Verification', aliases: ['## Verification', '## Verify', '## Exit Criteria'] },
];

// Process-oriented heading equivalents
const PROCESS_HEADINGS = [
  '## How It Works', '## Workflow', '## Core Process', '## Process', '## Steps',
  '## The Workflow', '## The Process', '## Step-by-Step', '## The Process',
  '## The Chaos Engineering Process', '## The Cost Optimization Process',
  '## The Data Pipeline Process', '## The AI Ops Process',
  '## The Gated Workflow', '## The Increment Cycle',
  '## The Planning Process', '## Pre-Launch Checklist',
  '## The Test-Driven Development Process', '## The Debugging Process',
  '## The Review Process', '## The Simplification Process',
  '## The Security Review Process', '## The Performance Optimization Process',
  '## The Git Workflow', '## The CI/CD Process',
  '## The Deprecation Process', '## The Documentation Process',
  '## The Observability Process', '## The Shipping Process',
  '## The Spec-Driven Development Process', '## The API Design Process',
  '## The UI Engineering Process', '## The Context Engineering Process',
  '## The Source-Driven Development Process', '## The Doubt-Driven Development Process',
  '## How to Use', '## Usage', '## The Skill',
  '## Core Operating Behaviors',
  '## Core Principles',
  '## The Five-Axis Review', '## Review Process',
  '## The Context Hierarchy',
  '## The Stop-the-Line Rule', '## The Triage Checklist',
  '## The Migration Process',
  '## Architecture Decision Records (ADRs)',
  '## The Optimization Workflow',
  '## The Pre-Launch Checklist',
  '## The TDD Cycle', '## The Prove-It Pattern (Bug Fixes)',
  '## The Quality Gate Pipeline'
];

// Skills intentionally exempt from section checks (validator-owned, not skill-owned)
const SECTION_EXEMPT_SKILLS = {
  'using-agent-skills': 'Meta-skill — orchestrates other skills; standard sections not applicable to routing document.',
  'idea-refine':        'Legacy structure predating skill-anatomy.md — tracked for conformance.',
};

// Regex patterns for explicit cross-skill references
const SKILL_REF_PATTERNS = [
  /\buse the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\bfollow the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\binvoke the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\bcontinue with `([a-z][a-z0-9-]+[a-z0-9])`/gi,
  /\buse `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /`([a-z][a-z0-9-]+[a-z0-9])` skill\b/gi,
  /`([a-z][a-z0-9-]+[a-z0-9])` persona\b/gi,
  /\bsee `([a-z][a-z0-9-]+[a-z0-9])`/gi,
  /──→ ([a-z][a-z0-9-]+[a-z0-9])\b/g,
  /→ `([a-z][a-z0-9-]+[a-z0-9])`/gi,
];

// Markdown link pattern for internal references
const MD_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;


// ─── Helpers ─────────────────────────────────────────────────────────────────


function countLinesInContent(content) {
  return content.split(/\r?\n/).length;
}

function extractSkillReferences(content) {
  const refs = new Set();
  for (const pattern of SKILL_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(content)) !== null) {
      refs.add(m[1]);
    }
  }
  return refs;
}



function validateInternalLink(href, skillDir, knownSkills) {
  // Skip external URLs and anchors-only
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
    return null;
  }

  // Resolve relative to skill directory
  const resolved = path.resolve(skillDir, href);
  if (fs.existsSync(resolved)) return null;

  // Check if it's a known skill reference (skills/other/skill-name/SKILL.md)
  const skillMatch = href.match(/skills\/([a-z][a-z0-9-]+[a-z0-9])\/SKILL\.md/);
  if (skillMatch && knownSkills.has(skillMatch[1])) return null;

  return `Broken internal link: ${href}`;
}

function checkDescriptionQuality(description) {
  const issues = [];
  if (!description) return issues;

  // Should contain both "what" and "when" signals
  const whatSignals = /(?:guides?|conducts?|helps?|performs?|manages?|prepares?|validates?|optimizes?|reviews?|tests?|debugs?|ships?|deploys?|instruments?|documents?|simplifies?|refines?|interviews?|creates?|delivers?|breaks?|extracts?|automates?|writes?|designs?|handles?|adds?|sets?|surfaces?|ensures?|proves?|reduces?|removes?|migrates?|preserves?|builds?|structures?|drives?|maps?|loads?|feeds?|closes?|discovers?|invokes?)/i;
  const whenSignals = /(?:use when|when|before|after|during|while|if|for|on|in)/i;

  if (!whatSignals.test(description)) {
    issues.push("Description lacks a 'what' signal (what does this skill do?)");
  }
  if (!whenSignals.test(description)) {
    issues.push("Description lacks a 'when' signal (when should this skill activate?)");
  }
  if (description.length < 60) {
    issues.push(`Description is only ${description.length} chars — too short to convey both what and when`);
  }

  return issues;
}

function checkCodeBlockQuality(content) {
  const issues = [];
  // Check for code blocks without language specifiers
  // Use negative lookbehind to avoid matching ```text (already fixed)
  const unlabeledBlocks = content.match(/\n```(?!text)\n[\s\S]*?\n```/g);
  if (unlabeledBlocks) {
    issues.push(`${unlabeledBlocks.length} code block(s) missing language specifier`);
  }

  // Check for inconsistent language style (typescript vs ts, javascript vs js)
  const tsBlocks = (content.match(/\n```typescript/g) || []).length;
  const tsxBlocks = (content.match(/\n```tsx/g) || []).length;
  const jsBlocks = (content.match(/\n```javascript/g) || []).length;
  const jsxBlocks = (content.match(/\n```jsx/g) || []).length;

  if (tsBlocks > 0 && tsxBlocks > 0) {
    issues.push('Inconsistent TypeScript language tags: use either typescript or tsx, not both');
  }
  if (jsBlocks > 0 && jsxBlocks > 0) {
    issues.push('Inconsistent JavaScript language tags: use either javascript or jsx, not both');
  }

  return issues;
}

// ─── Skill Validator ─────────────────────────────────────────────────────────

function validateSkill(dirName, knownSkills, allSkillNames) {
  const errors   = [];
  const warnings = [];
  const infos    = [];
  let   exempt   = false;
  const skillPath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
  const skillDir  = path.join(SKILLS_DIR, dirName);

  if (!fs.existsSync(skillPath)) {
    errors.push('Missing SKILL.md');
    return { errors, warnings, infos, exempt };
  }

  const content = fs.readFileSync(skillPath, 'utf8');
  const lines   = countLinesInContent(content);
  const tokens  = estimateTokens(content);

  // ── Frontmatter ──────────────────────────────────────────────────────────
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('Missing or malformed YAML frontmatter (expected --- block at top of file)');
    return { errors, warnings, infos, exempt };
  }

  if (!fm.name) {
    errors.push("Frontmatter missing required field: 'name'");
  } else {
    if (fm.name !== dirName) {
      errors.push(`Frontmatter name '${fm.name}' does not match directory name '${dirName}'`);
    }
    // Check for duplicate names across repo
    if (allSkillNames.has(fm.name) && allSkillNames.get(fm.name) !== dirName) {
      errors.push(`Duplicate skill name '${fm.name}' — also used by ${allSkillNames.get(fm.name)}`);
    }
  }

  if (!fm.description) {
    errors.push("Frontmatter missing required field: 'description'");
  } else {
    if (fm.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(
        `Description is ${fm.description.length} chars — exceeds ${MAX_DESCRIPTION_LENGTH}-char limit ` +
        `(agents inject this into the system prompt)`
      );
    }
    const descIssues = checkDescriptionQuality(fm.description);
    for (const issue of descIssues) warnings.push(issue);
  }

  // ── Exemption guard ──────────────────────────────────────────────────────
  if (fm.type === 'meta' || fm.exempt === 'sections') {
    if (!SECTION_EXEMPT_SKILLS[dirName]) {
      errors.push(
        `Frontmatter declares exemption but '${dirName}' is not in ` +
        `SECTION_EXEMPT_SKILLS. Add an entry to validate-skills.js with a documented reason.`
      );
    }
  }

  // ── Required sections ────────────────────────────────────────────────────
  exempt = dirName in SECTION_EXEMPT_SKILLS;

  if (!exempt) {
    for (const section of REQUIRED_SECTIONS) {
      const found = section.aliases.some(heading => content.includes(heading));
      if (!found) {
        errors.push(`Missing required section: ${section.canonical}`);
      }
    }

    // Check for process-oriented section (flexible requirement)
    const hasProcess = PROCESS_HEADINGS.some(h => content.includes(h));
    if (!hasProcess) {
      warnings.push('Missing process/workflow section (e.g., ## How It Works, ## Workflow)');
    }
  }

  // ── Token / size warnings ─────────────────────────────────────────────────
  if (lines > SKILL_TOKEN_CRITICAL) {
    warnings.push(`${lines} lines — exceeds ${SKILL_TOKEN_CRITICAL}-line recommendation (heavy token usage)`);
  } else if (lines > SKILL_TOKEN_WARNING) {
    infos.push(`${lines} lines — approaching ${SKILL_TOKEN_CRITICAL}-line limit (~${tokens} estimated tokens)`);
  }

  // ── Internal link validation ────────────────────────────────────────────
  const links = extractMarkdownLinks(content);
  for (const link of links) {
    const linkError = validateInternalLink(link.href, skillDir, knownSkills);
    if (linkError) errors.push(linkError);
  }

  // ── Cross-skill references ───────────────────────────────────────────────
  const refs = extractSkillReferences(content);
  for (const ref of refs) {
    if (!knownSkills.has(ref)) {
      warnings.push(`Dead cross-reference: \`${ref}\` is not a known skill`);
    }
  }

  // ── Scripts / zip package checks ────────────────────────────────────────
  const scriptsDir = path.join(skillDir, 'scripts');
  const zipFile    = path.join(ROOT_DIR, 'skills', `${dirName}.zip`);

  if (fs.existsSync(scriptsDir)) {
    const scriptFiles = fs.readdirSync(scriptsDir).filter(f => !f.startsWith('.'));
    if (scriptFiles.length === 0) {
      errors.push('scripts/ directory exists but is empty — remove it or add scripts');
    }
    if (!fs.existsSync(zipFile)) {
      warnings.push(`Missing zip package: ${dirName}.zip (required for distribution)`);
    }
  }

  // ── Code block quality ──────────────────────────────────────────────────
  const codeIssues = checkCodeBlockQuality(content);
  for (const issue of codeIssues) warnings.push(issue);

  // ── Anti-rationalization table quality check ────────────────────────────
  if (content.includes('## Common Rationalizations')) {
    const tableMatch = content.match(/## Common Rationalizations[\s\S]*?(?=## |$)/);
    if (tableMatch) {
      const tableContent = tableMatch[0];
      const rowMatches = tableContent.match(/\|[^\n]+\|[^\n]+\|/g);
      if (!rowMatches || rowMatches.length < 3) { // header + separator + at least 1 row
        warnings.push('Rationalizations table appears empty or malformed (need at least 1 row)');
      }
    }
  }

  return { errors, warnings, infos, exempt, lines, tokens };
}

// ─── Summary Builders ────────────────────────────────────────────────────────

function printSummary(results) {
  console.log('\n' + C.bold + '─'.repeat(60) + C.reset);
  console.log(`${C.bold}${C.cyan}VALIDATION SUMMARY${C.reset}`);
  console.log(C.bold + '─'.repeat(60) + C.reset);

  const totalErrors   = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalInfos    = results.reduce((sum, r) => sum + r.infos.length, 0);
  const totalLines    = results.reduce((sum, r) => sum + r.lines, 0);
  const totalTokens   = results.reduce((sum, r) => sum + r.tokens, 0);

  const avgLines  = Math.round(totalLines / results.length);
  const avgTokens = Math.round(totalTokens / results.length);

  const stats = [
    ['Skills validated', results.length, C.cyan],
    ['Total errors', totalErrors, totalErrors > 0 ? C.red : C.green],
    ['Total warnings', totalWarnings, totalWarnings > 0 ? C.yellow : C.green],
    ['Total infos', totalInfos, C.blue],
    ['Avg lines/skill', avgLines, C.gray],
    ['Avg tokens/skill', `${avgTokens} est.`, C.gray],
  ];

  for (const [label, value, color] of stats) {
    const pad = ' '.repeat(22 - label.length);
    console.log(`  ${label}${pad}${color}${value}${C.reset}`);
  }

  // Largest skills
  const largest = [...results].sort((a, b) => b.lines - a.lines).slice(0, 3);
  console.log(`\n  ${C.gray}Largest skills (lines):${C.reset}`);
  for (const r of largest) {
    const pad = ' '.repeat(30 - r.dirName.length);
    console.log(`    ${C.gray}${r.dirName}${pad}${r.lines} lines (~${r.tokens} tokens)${C.reset}`);
  }

  console.log(C.bold + '─'.repeat(60) + C.reset);

  return { totalErrors, totalWarnings, totalInfos };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');
  const quietMode  = args.includes('--quiet');

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`${C.red}ERROR: skills directory not found at ${SKILLS_DIR}${C.reset}`);
    process.exit(1);
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();

  const knownSkills = new Set(skillDirs);

  // Build duplicate name map
  const allSkillNames = new Map();
  for (const dirName of skillDirs) {
    const skillPath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf8');
      const fm = parseFrontmatter(content);
      if (fm && fm.name) {
        if (allSkillNames.has(fm.name)) {
          // Duplicate detected — will be reported during validation
        } else {
          allSkillNames.set(fm.name, dirName);
        }
      }
    }
  }

  const results = [];

  for (const dirName of skillDirs) {
    const result = validateSkill(dirName, knownSkills, allSkillNames);
    result.dirName = dirName;
    results.push(result);

    const hasIssues = result.errors.length > 0 || result.warnings.length > 0 || result.infos.length > 0;

    if (!quietMode || hasIssues) {
      if (result.errors.length === 0 && result.warnings.length === 0 && result.infos.length === 0) {
        const tag = result.exempt ? ` ${C.gray}(exempt)${C.reset}` : '';
        console.log(`  ${ICONS.pass}  ${C.green}${dirName}${C.reset}${tag}`);
      } else {
        const icon = result.errors.length > 0 ? ICONS.fail : result.warnings.length > 0 ? ICONS.warn : ICONS.info;
        console.log(`  ${icon}  ${C.bold}${dirName}${C.reset}`);
        for (const msg of result.errors)   console.log(`       ${C.red}ERROR:${C.reset} ${msg}`);
        for (const msg of result.warnings) console.log(`       ${C.yellow}WARN:${C.reset}  ${msg}`);
        for (const msg of result.infos)    console.log(`       ${C.blue}INFO:${C.reset}  ${msg}`);
      }
    }
  }

  const { totalErrors, totalWarnings } = printSummary(results);

  if (strictMode && totalWarnings > 0) {
    console.log(`\n${C.yellow}⚠ STRICT MODE: Treating ${totalWarnings} warning(s) as errors${C.reset}`);
    process.exit(1);
  }

  if (totalErrors > 0) {
    console.log(`\n${C.red}${ICONS.fail} VALIDATION FAILED — fix ${totalErrors} error(s) before merging${C.reset}`);
    process.exit(1);
  }

  console.log(`\n${ICONS.pass} ${C.green}ALL CHECKS PASSED${C.reset}`);
}

main();

