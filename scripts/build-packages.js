#!/usr/bin/env node
/**
 * build-packages.js  —  SKILL PACKAGE BUILDER
 *
 * Builds .zip packages for all skills that have a scripts/ directory.
 * Only rebuilds if the source files are newer than the existing package.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', gray: '\x1b[90m',
};

function getMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function getDirMtime(dirPath) {
  let latest = 0;
  if (!fs.existsSync(dirPath)) return 0;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        latest = Math.max(latest, getMtime(fullPath));
      }
    }
  }
  walk(dirPath);
  return latest;
}

function buildPackage(skillName) {
  const skillDir = path.join(SKILLS_DIR, skillName);
  const scriptsDir = path.join(skillDir, 'scripts');
  const zipPath = path.join(SKILLS_DIR, `${skillName}.zip`);

  if (!fs.existsSync(scriptsDir)) {
    return { status: 'skipped', reason: 'no scripts directory' };
  }

  const zipMtime = getMtime(zipPath);
  const sourceMtime = Math.max(getMtime(path.join(skillDir, 'SKILL.md')), getDirMtime(scriptsDir));

  if (zipMtime >= sourceMtime) {
    return { status: 'up-to-date', reason: 'package is current' };
  }

  try {
    const cmd = `cd "${SKILLS_DIR}" && zip -r "${skillName}.zip" "${skillName}/" -x "*.DS_Store" -x "*.git*"`;
    execSync(cmd, { stdio: 'pipe' });
    return { status: 'built', reason: 'rebuilt from source' };
  } catch (err) {
    return { status: 'error', reason: err.message };
  }
}

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`${C.red}ERROR: skills directory not found${C.reset}`);
    process.exit(1);
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();

  let built = 0;
  let upToDate = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`${C.blue}Building skill packages...${C.reset}\n`);

  for (const skill of skillDirs) {
    const result = buildPackage(skill);
    const icon = result.status === 'built' ? `${C.green}✓${C.reset}` :
                 result.status === 'up-to-date' ? `${C.gray}○${C.reset}` :
                 result.status === 'skipped' ? `${C.gray}−${C.reset}` :
                 `${C.yellow}⚠${C.reset}`;

    console.log(`  ${icon}  ${skill.padEnd(35)} ${C.gray}${result.reason}${C.reset}`);

    if (result.status === 'built') built++;
    else if (result.status === 'up-to-date') upToDate++;
    else if (result.status === 'skipped') skipped++;
    else errors++;
  }

  console.log(`\n${C.bold}Summary:${C.reset} ${C.green}${built} built${C.reset}, ${C.gray}${upToDate} up-to-date${C.reset}, ${C.gray}${skipped} skipped${C.reset}${errors > 0 ? `, ${C.yellow}${errors} errors${C.reset}` : ''}`);

  if (errors > 0) process.exit(1);
}

main();
