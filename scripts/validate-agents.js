#!/usr/bin/env node
/**
 * validate-agents.js  —  AGENT PERSONA VALIDATOR
 *
 * Validates all agent persona files in agents/:
 *   - YAML frontmatter with name and description
 *   - Description quality checks
 *   - References to known skills
 *   - Consistent structure markers
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Shared Utilities ──────────────────────────────────────────────────────

const {
  C, parseFrontmatter, readFileSafe,
} = require('./lib/utils');

const AGENTS_DIR = path.resolve(__dirname, '..', 'agents');
const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');

function getKnownSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(SKILLS_DIR)
      .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
  );
}

function validateAgent(fileName, knownSkills) {
  const errors = [];
  const warnings = [];
  const filePath = path.join(AGENTS_DIR, fileName);
  const content = fs.readFileSync(filePath, 'utf8');

  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('Missing or malformed YAML frontmatter');
    return { errors, warnings };
  }

  if (!fm.name) errors.push("Missing frontmatter field: 'name'");
  if (!fm.description) errors.push("Missing frontmatter field: 'description'");

  // Check for skill references
  const skillRefs = content.match(/`([a-z][a-z0-9-]+[a-z0-9])` skill/g) || [];
  for (const ref of skillRefs) {
    const skillName = ref.replace(/` skill/g, '').replace(/`/g, '');
    if (!knownSkills.has(skillName)) {
      warnings.push(`References unknown skill: ${skillName}`);
    }
  }

  // Check for output format template
  if (!content.includes('## Output') && !content.includes('## Output Format')) {
    warnings.push('Missing output format section');
  }

  // Check for composition rules
  if (!content.includes('## Composition') && !content.includes('## Rules')) {
    warnings.push('Missing composition/rules section');
  }

  return { errors, warnings };
}

function main() {
  if (!fs.existsSync(AGENTS_DIR)) {
    console.error(`${C.red}ERROR: agents directory not found${C.reset}`);
    process.exit(1);
  }

  const agentFiles = fs.readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();

  const knownSkills = getKnownSkills();
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log(`${C.cyan}Validating ${agentFiles.length} agent persona(s)...${C.reset}\n`);

  for (const file of agentFiles) {
    const { errors, warnings } = validateAgent(file, knownSkills);
    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ${C.green}✓${C.reset}  ${file}`);
    } else {
      const icon = errors.length > 0 ? `${C.red}✗${C.reset}` : `${C.yellow}⚠${C.reset}`;
      console.log(`  ${icon}  ${C.bold}${file}${C.reset}`);
      for (const e of errors) console.log(`       ${C.red}ERROR:${C.reset} ${e}`);
      for (const w of warnings) console.log(`       ${C.yellow}WARN:${C.reset}  ${w}`);
    }
  }

  const status = totalErrors > 0 ? `${C.red}FAILED${C.reset}` : `${C.green}PASSED${C.reset}`;
  console.log(`\n${agentFiles.length} agents — ${totalErrors} error(s), ${totalWarnings} warning(s) — ${status}`);

  if (totalErrors > 0) process.exit(1);
}

main();
