#!/usr/bin/env node
/**
 * lib/utils.js — SHARED UTILITIES FOR ALL VALIDATION SCRIPTS
 *
 * Centralizes common logic to eliminate duplication across scripts:
 *   - Frontmatter parsing
 *   - Terminal colors
 *   - File system helpers
 *   - Markdown link extraction
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Terminal Colors ─────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  gray:    '\x1b[90m',
};

const ICONS = {
  pass:   `${C.green}✓${C.reset}`,
  fail:   `${C.red}✗${C.reset}`,
  warn:   `${C.yellow}⚠${C.reset}`,
  info:   `${C.blue}ℹ${C.reset}`,
  star:   `${C.magenta}★${C.reset}`,
  bullet: `${C.gray}•${C.reset}`,
};

// ─── Frontmatter ────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown content.
 * Returns null if no frontmatter found, or an object of key/value pairs.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

// ─── File System Helpers ───────────────────────────────────────────────────

/**
 * Safely read a file. Returns empty string on failure (logs to stderr).
 */
function readFileSafe(filePath, encoding = 'utf8') {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    console.error(`${ICONS.warn}  ${C.yellow}Could not read ${filePath}: ${err.message}${C.reset}`);
    return '';
  }
}

/**
 * Count lines in a file. Returns 0 if file doesn't exist.
 */
function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = readFileSafe(filePath);
  return content ? content.split(/\r?\n/).length : 0;
}

/**
 * Recursively count files with a given extension.
 */
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

/**
 * Recursively get the latest mtime of any file in a directory.
 */
function getDirMtime(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let latest = 0;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          const mtime = fs.statSync(fullPath).mtimeMs;
          if (mtime > latest) latest = mtime;
        } catch {
          // Ignore unreadable files
        }
      }
    }
  }

  walk(dirPath);
  return latest;
}

/**
 * Get mtime of a single file. Returns 0 on failure.
 */
function getMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

// ─── Markdown Helpers ──────────────────────────────────────────────────────

/**
 * Extract all markdown links [text](href) from content.
 */
function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    links.push({ text: m[1], href: m[2] });
  }
  return links;
}

/**
 * Estimate tokens from content length (rough: ~4 chars/token).
 */
function estimateTokens(content) {
  return Math.ceil(content.length / 4);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  C,
  ICONS,
  parseFrontmatter,
  readFileSafe,
  countLines,
  countFiles,
  getDirMtime,
  getMtime,
  extractMarkdownLinks,
  estimateTokens,
};
