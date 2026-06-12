#!/usr/bin/env node
/**
 * Validates eval scenario files in evals/.
 *
 * Checks:
 *   - frontmatter has skill, scenario, failure-mode
 *   - the skill field points to an existing skill directory
 *   - required sections exist: Setup, Task Prompt, Trap, Rubric
 *   - the rubric contains at least 3 checkbox criteria
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EVALS_DIR = path.join(ROOT, 'evals');
const SKILLS_DIR = path.join(ROOT, 'skills');

const REQUIRED_SECTIONS = ['## Setup', '## Task Prompt', '## Trap', '## Rubric'];
const REQUIRED_FRONTMATTER = ['skill', 'scenario', 'failure-mode'];

let errors = 0;
let scenarios = 0;

function fail(file, msg) {
  console.error(`  ✗ ${path.relative(ROOT, file)}: ${msg}`);
  errors++;
}

if (!fs.existsSync(EVALS_DIR)) {
  console.error('No evals/ directory found.');
  process.exit(1);
}

const skillDirs = new Set(
  fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
);

for (const entry of fs.readdirSync(EVALS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillName = entry.name;
  if (!skillDirs.has(skillName)) {
    fail(path.join(EVALS_DIR, skillName), `directory does not match any skill in skills/`);
    continue;
  }
  const dir = path.join(EVALS_DIR, skillName);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    scenarios++;
    const file = path.join(dir, f);
    const content = fs.readFileSync(file, 'utf8');

    // Frontmatter
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) {
      fail(file, 'missing YAML frontmatter');
      continue;
    }
    for (const key of REQUIRED_FRONTMATTER) {
      if (!new RegExp(`^${key}:`, 'm').test(fm[1])) {
        fail(file, `frontmatter missing required field: ${key}`);
      }
    }
    const skillField = fm[1].match(/^skill:\s*(\S+)/m);
    if (skillField && skillField[1] !== skillName) {
      fail(file, `frontmatter skill "${skillField[1]}" does not match directory "${skillName}"`);
    }

    // Required sections
    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        fail(file, `missing required section: ${section}`);
      }
    }

    // Rubric criteria
    const checkboxes = (content.match(/^- \[ \]/gm) || []).length;
    if (checkboxes < 3) {
      fail(file, `rubric has ${checkboxes} criteria; minimum is 3`);
    }
  }
}

console.log(`\nEval scenarios validated: ${scenarios}`);
if (errors > 0) {
  console.error(`${errors} error(s) — FAILED`);
  process.exit(1);
}
console.log('0 error(s) — PASSED');
