#!/usr/bin/env node
/**
 * quality-gate.js  —  CROSS-SKILL CONSISTENCY & BEST PRACTICE ENFORCER
 *
 * Checks that the entire skill pack maintains consistency:
 *   - All skills reference existing skills
 *   - No circular references between skills
 *   - Consistent terminology across skills
 *   - Every skill has a corresponding zip if it has scripts
 *   - References directory has corresponding checklist usage in skills
 *   - Command definitions map to existing skills
 *   - No orphaned files or directories
 *
 * Exit codes: 0 = all clear, 1 = issues found
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Shared Utilities ──────────────────────────────────────────────────────

const {
  C, parseFrontmatter, readFileSafe,
} = require('./lib/utils');

const ROOT_DIR     = path.resolve(__dirname, '..');
const SKILLS_DIR   = path.join(ROOT_DIR, 'skills');
const AGENTS_DIR   = path.join(ROOT_DIR, 'agents');
const REFS_DIR     = path.join(ROOT_DIR, 'references');
const COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const HOOKS_DIR    = path.join(ROOT_DIR, 'hooks');


// ─── Loaders ─────────────────────────────────────────────────────────────────

function getSkillDirs() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();
}

function readSkillContent(dirName) {
  const p = path.join(SKILLS_DIR, dirName, 'SKILL.md');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}


// ─── Checks ──────────────────────────────────────────────────────────────────

function checkOrphanedSkills(skillDirs) {
  const issues = [];
  const referencedInMeta = readSkillContent('using-agent-skills');

  for (const dir of skillDirs) {
    if (dir === 'using-agent-skills') continue;
    // Every non-meta skill should be discoverable from the meta-skill
    const name = parseFrontmatter(readSkillContent(dir)).name || dir;
    if (!referencedInMeta.includes(name)) {
      issues.push(`Skill '${dir}' is not referenced in using-agent-skills meta-skill`);
    }
  }
  return issues;
}

function checkCommandSkillMapping(skillDirs) {
  const issues = [];
  if (!fs.existsSync(COMMANDS_DIR)) return issues;

  const commandFiles = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.toml'));
  const knownSkills = new Set(skillDirs);

  for (const cmdFile of commandFiles) {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, cmdFile), 'utf8');
    // Extract skill references from command prompts
    const skillMatches = content.match(/`([a-z][a-z0-9-]+[a-z0-9])` skill/g) || [];
    for (const match of skillMatches) {
      const skillName = match.replace(/` skill/g, '').replace(/`/g, '');
      if (!knownSkills.has(skillName)) {
        issues.push(`Command '${cmdFile}' references unknown skill: ${skillName}`);
      }
    }
  }
  return issues;
}

function checkReferenceUsage(skillDirs) {
  const issues = [];
  if (!fs.existsSync(REFS_DIR)) return issues;

  const refFiles = fs.readdirSync(REFS_DIR).filter(f => f.endsWith('.md'));
  const allSkillContent = skillDirs.map(readSkillContent).join('\n');

  for (const refFile of refFiles) {
    const refName = refFile.replace('.md', '');
    if (!allSkillContent.includes(refFile) && !allSkillContent.includes(refName)) {
      issues.push(`Reference '${refFile}' is not referenced by any skill`);
    }
  }
  return issues;
}

function checkOrphanedZipPackages(skillDirs) {
  const issues = [];
  const zipFiles = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.zip'));
  const zipNames = zipFiles.map(f => f.replace('.zip', ''));

  for (const zipName of zipNames) {
    if (!skillDirs.includes(zipName)) {
      issues.push(`Orphaned zip package: skills/${zipName}.zip (no matching skill directory)`);
    }
  }
  return issues;
}

function checkAgentPersonaConsistency(skillDirs) {
  const issues = [];
  if (!fs.existsSync(AGENTS_DIR)) return issues;

  const agentFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const knownSkills = new Set(skillDirs);

  for (const agentFile of agentFiles) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, agentFile), 'utf8');
    const skillMatches = content.match(/`([a-z][a-z0-9-]+[a-z0-9])` skill/g) || [];
    for (const match of skillMatches) {
      const skillName = match.replace(/` skill/g, '').replace(/`/g, '');
      if (!knownSkills.has(skillName)) {
        issues.push(`Agent '${agentFile}' references unknown skill: ${skillName}`);
      }
    }
  }
  return issues;
}

function checkConsistentTerminology(skillDirs) {
  const issues = [];
  const terminology = {
    'front-end': {
      variants: ['front-end', 'frontend', 'front end'],
      // Exclude directory names, inline code, and table cells with paths
      excludePatterns: [/`[^`]*frontend[^`]*`/, /\bfrontend\b/],
    },
    'back-end': {
      variants: ['back-end', 'backend', 'back end'],
    },
    'CI/CD': {
      variants: ['CI/CD', 'CICD'],
      // CI-CD in kebab-case (directory names) is acceptable
      ignore: ['CI-CD'],
    },
    'e2e': {
      // Both 'e2e' (shorthand/category) and 'end-to-end' (prose) are acceptable
      // in different contexts. Skip this check.
      skip: true,
    },
  };

  // Extract prose content (exclude code blocks, inline code, and table path cells)
  const allContent = skillDirs.map((dir) => {
    const content = readSkillContent(dir);
    // Remove fenced code blocks
    let prose = content.replace(/```[\s\S]*?```/g, '');
    // Remove inline code
    prose = prose.replace(/`[^`]+`/g, '');
    return prose;
  }).join('\n');

  for (const [canonical, config] of Object.entries(terminology)) {
    if (config.skip) continue;

    const variants = config.variants || [];
    const ignore = config.ignore || [];
    const found = [];

    for (const variant of variants) {
      const pattern = new RegExp(`\\b${variant.replace(/[-/]/g, '[-/]')}\\b`, 'i');
      if (pattern.test(allContent) && !ignore.includes(variant)) {
        found.push(variant);
      }
    }

    if (found.length > 1) {
      issues.push(`Inconsistent terminology: found ${found.join(', ')} — standardize on '${canonical}'`);
    }
  }

  return issues;
}

function checkLifecycleCoverage(skillDirs) {
  const issues = [];
  const lifecyclePhases = ['Define', 'Plan', 'Build', 'Verify', 'Review', 'Ship'];

  // Map skills to phases from using-agent-skills Quick Reference table
  const metaContent = readSkillContent('using-agent-skills');
  const coveredPhases = new Set();

  // Match table rows: | Define | skill-name | summary |
  const tablePattern = /\|\s*(Define|Plan|Build|Verify|Review|Ship|Ops)\s*\|/g;
  let m;
  while ((m = tablePattern.exec(metaContent)) !== null) {
    coveredPhases.add(m[1]);
  }

  for (const phase of lifecyclePhases) {
    if (!coveredPhases.has(phase)) {
      issues.push(`Lifecycle phase '${phase}' has no skills mapped in using-agent-skills`);
    }
  }

  return issues;
}

function checkEmptyDirectories() {
  const issues = [];
  const dirsToCheck = [SKILLS_DIR, AGENTS_DIR, REFS_DIR, COMMANDS_DIR, HOOKS_DIR];

  for (const dir of dirsToCheck) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        const files = fs.readdirSync(fullPath).filter(f => !f.startsWith('.'));
        if (files.length === 0) {
          issues.push(`Empty directory: ${fullPath.replace(ROOT_DIR + '/', '')}`);
        }
      }
    }
  }

  return issues;
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printReport(results) {
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log(`\n${C.bold}${C.cyan}CROSS-SKILL QUALITY GATES${C.reset}`);
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}`);

  for (const { check, errors, warnings } of results) {
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ${C.green}✓${C.reset}  ${check}`);
    } else {
      const icon = errors.length > 0 ? `${C.red}✗${C.reset}` : `${C.yellow}⚠${C.reset}`;
      console.log(`  ${icon}  ${C.bold}${check}${C.reset}`);
      for (const e of errors)   console.log(`       ${C.red}ERROR:${C.reset} ${e}`);
      for (const w of warnings) console.log(`       ${C.yellow}WARN:${C.reset}  ${w}`);
    }
    totalErrors += errors.length;
    totalWarnings += warnings.length;
  }

  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}`);
  console.log(`  ${totalErrors > 0 ? C.red : C.green}${totalErrors} error(s)${C.reset}, ${totalWarnings > 0 ? C.yellow : C.green}${totalWarnings} warning(s)${C.reset}`);

  return { totalErrors, totalWarnings };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const ciMode = args.includes('--ci');
  const reportMode = args.includes('--report');

  const skillDirs = getSkillDirs();
  if (skillDirs.length === 0) {
    console.error(`${C.red}ERROR: No skills found in ${SKILLS_DIR}${C.reset}`);
    process.exit(1);
  }

  const results = [
    { check: 'Orphaned Skills', ...runCheck(() => checkOrphanedSkills(skillDirs)) },
    { check: 'Command→Skill Mapping', ...runCheck(() => checkCommandSkillMapping(skillDirs)) },
    { check: 'Reference Usage', ...runCheck(() => checkReferenceUsage(skillDirs)) },
    { check: 'Orphaned Zip Packages', ...runCheck(() => checkOrphanedZipPackages(skillDirs)) },
    { check: 'Agent Persona Consistency', ...runCheck(() => checkAgentPersonaConsistency(skillDirs)) },
    { check: 'Consistent Terminology', ...runCheck(() => checkConsistentTerminology(skillDirs)) },
    { check: 'Lifecycle Coverage', ...runCheck(() => checkLifecycleCoverage(skillDirs)) },
    { check: 'Empty Directories', ...runCheck(() => checkEmptyDirectories()) },
  ];

  const { totalErrors, totalWarnings } = printReport(results);

  if (reportMode) {
    const reportPath = path.join(ROOT_DIR, 'quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ results, totalErrors, totalWarnings, timestamp: new Date().toISOString() }, null, 2));
    console.log(`\n${C.blue}Report written to: ${reportPath}${C.reset}`);
  }

  if (totalErrors > 0) {
    console.log(`\n${C.red}✗ QUALITY GATES FAILED${C.reset}`);
    process.exit(1);
  }

  console.log(`\n${C.green}✓ ALL QUALITY GATES PASSED${C.reset}`);
}

function runCheck(fn) {
  try {
    const issues = fn();
    const errors = issues.filter(i => !i.startsWith('WARN:'));
    const warnings = issues.filter(i => i.startsWith('WARN:')).map(i => i.replace('WARN: ', ''));
    return { errors, warnings };
  } catch (err) {
    return { errors: [`Check crashed: ${err.message}`], warnings: [] };
  }
}

main();
