#!/usr/bin/env node
/**
 * project-stats.js  —  PROJECT HEALTH DASHBOARD
 *
 * Generates statistics about the SkillEngine project:
 *   - Skill count and distribution by phase
 *   - Lines of code / documentation
 *   - Coverage metrics
 *   - Maintenance indicators
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m',
  green: '\x1b[32m', yellow: '\x1b[33m', gray: '\x1b[90m',
};

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split(/\r?\n/).length;
}

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath, ext);
    } else if (!ext || entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

function getSkillPhase(skillName, metaContent) {
  const patterns = [
    { phase: 'Define', regex: /Define.*\n.*\b${skill}\b/i },
    { phase: 'Plan', regex: /Plan.*\n.*\b${skill}\b/i },
    { phase: 'Build', regex: /Build.*\n.*\b${skill}\b/i },
    { phase: 'Verify', regex: /Verify.*\n.*\b${skill}\b/i },
    { phase: 'Review', regex: /Review.*\n.*\b${skill}\b/i },
    { phase: 'Ship', regex: /Ship.*\n.*\b${skill}\b/i },
  ];

  for (const p of patterns) {
    const regex = new RegExp(p.regex.source.replace('${skill}', skillName), 'i');
    if (regex.test(metaContent)) return p.phase;
  }

  // Fallback: check meta-skill quick reference table
  const tableMatch = metaContent.match(new RegExp(`\\|[^\\n]*${skillName}[^\\n]*\\|`, 'g'));
  if (tableMatch) {
    const line = tableMatch[0];
    if (line.includes('Define')) return 'Define';
    if (line.includes('Plan')) return 'Plan';
    if (line.includes('Build')) return 'Build';
    if (line.includes('Verify')) return 'Verify';
    if (line.includes('Review')) return 'Review';
    if (line.includes('Ship')) return 'Ship';
  }

  return 'Unknown';
}

function main() {
  const skillsDir = path.join(ROOT, 'skills');
  const agentsDir = path.join(ROOT, 'agents');
  const refsDir = path.join(ROOT, 'references');
  const commandsDir = path.join(ROOT, 'commands');
  const hooksDir = path.join(ROOT, 'hooks');

  const metaContent = fs.existsSync(path.join(skillsDir, 'using-agent-skills', 'SKILL.md'))
    ? fs.readFileSync(path.join(skillsDir, 'using-agent-skills', 'SKILL.md'), 'utf8')
    : '';

  const skillDirs = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
    : [];

  // Phase distribution
  const phases = { Define: 0, Plan: 0, Build: 0, Verify: 0, Review: 0, Ship: 0, Unknown: 0, Meta: 0 };
  let totalSkillLines = 0;
  let totalScriptLines = 0;

  for (const skill of skillDirs) {
    const phase = skill === 'using-agent-skills' ? 'Meta' : getSkillPhase(skill, metaContent);
    phases[phase] = (phases[phase] || 0) + 1;

    const skillMd = path.join(skillsDir, skill, 'SKILL.md');
    totalSkillLines += countLines(skillMd);

    const scriptsDir = path.join(skillsDir, skill, 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scriptFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.sh'));
      for (const sf of scriptFiles) {
        totalScriptLines += countLines(path.join(scriptsDir, sf));
      }
    }
  }

  // File counts
  const stats = {
    skills: skillDirs.length,
    agents: fs.existsSync(agentsDir) ? countFiles(agentsDir, '.md') : 0,
    references: fs.existsSync(refsDir) ? countFiles(refsDir, '.md') : 0,
    commands: fs.existsSync(commandsDir) ? countFiles(commandsDir, '.toml') : 0,
    hooks: fs.existsSync(hooksDir) ? countFiles(hooksDir, '.sh') : 0,
    skillLines: totalSkillLines,
    scriptLines: totalScriptLines,
    docsLines: 0, // Will calculate
  };

  // Calculate docs lines
  const docsDir = path.join(ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    const docFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    for (const df of docFiles) {
      stats.docsLines += countLines(path.join(docsDir, df));
    }
  }

  // Output
  console.log(`\n${C.bold}${C.cyan}SKILLENGINE — PROJECT DASHBOARD${C.reset}`);
  console.log(`${C.bold}${'═'.repeat(50)}${C.reset}`);

  console.log(`\n${C.bold}Inventory${C.reset}`);
  const invPad = 20;
  console.log(`  ${'Skills'.padEnd(invPad)}${C.green}${stats.skills}${C.reset}`);
  console.log(`  ${'Agents'.padEnd(invPad)}${C.green}${stats.agents}${C.reset}`);
  console.log(`  ${'References'.padEnd(invPad)}${C.green}${stats.references}${C.reset}`);
  console.log(`  ${'Commands'.padEnd(invPad)}${C.green}${stats.commands}${C.reset}`);
  console.log(`  ${'Hooks'.padEnd(invPad)}${C.green}${stats.hooks}${C.reset}`);

  console.log(`\n${C.bold}Phase Distribution${C.reset}`);
  for (const [phase, count] of Object.entries(phases)) {
    if (count === 0) continue;
    const bar = '█'.repeat(count);
    const pct = Math.round((count / stats.skills) * 100);
    console.log(`  ${phase.padEnd(10)} ${C.green}${bar}${C.reset} ${count} (${pct}%)`);
  }

  console.log(`\n${C.bold}Documentation Volume${C.reset}`);
  console.log(`  ${'Skill definitions'.padEnd(invPad)}${C.cyan}${stats.skillLines.toLocaleString()}${C.reset} lines`);
  console.log(`  ${'Shell scripts'.padEnd(invPad)}${C.cyan}${stats.scriptLines.toLocaleString()}${C.reset} lines`);
  console.log(`  ${'Docs & guides'.padEnd(invPad)}${C.cyan}${stats.docsLines.toLocaleString()}${C.reset} lines`);

  const totalLines = stats.skillLines + stats.scriptLines + stats.docsLines;
  console.log(`  ${C.gray}${'─'.repeat(30)}${C.reset}`);
  console.log(`  ${'Total'.padEnd(invPad)}${C.bold}${totalLines.toLocaleString()}${C.reset} lines`);

  console.log(`\n${C.bold}Health Indicators${C.reset}`);
  const hasValidation = fs.existsSync(path.join(ROOT, 'scripts', 'validate-skills.js'));
  const hasCI = fs.existsSync(path.join(ROOT, '.github', 'workflows'));
  const hasPackage = fs.existsSync(path.join(ROOT, 'package.json'));

  console.log(`  ${'Validation scripts'.padEnd(invPad)}${hasValidation ? C.green + '✓ Present' : C.yellow + '✗ Missing'}${C.reset}`);
  console.log(`  ${'CI/CD pipeline'.padEnd(invPad)}${hasCI ? C.green + '✓ Present' : C.yellow + '✗ Missing'}${C.reset}`);
  console.log(`  ${'Package manifest'.padEnd(invPad)}${hasPackage ? C.green + '✓ Present' : C.yellow + '✗ Missing'}${C.reset}`);

  console.log(`\n${C.gray}Run 'node scripts/quality-gate.js --report' for detailed analysis.${C.reset}\n`);
}

main();
