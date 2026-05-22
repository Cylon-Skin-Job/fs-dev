/**
 * Ticket loader — reads ticket markdown files, returns parsed frontmatter + body
 *
 * Pure data-access module (Layer 4). Returns data only.
 * No events, no DOM, no business logic.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../frontmatter');

/**
 * Parse a ticket markdown file into frontmatter object + body string.
 * @param {string} filePath - Absolute path to a ticket .md file
 * @returns {{ frontmatter: Object, body: string, filename: string } | null}
 */
function loadTicket(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const { frontmatter, body } = parseFrontmatter(raw, 'ticket');

  // A ticket must have at least one frontmatter field. If the file has no
  // --- block, parseFrontmatter returns { frontmatter: {}, body: raw } —
  // that's "not a ticket" in this context, so return null to match the
  // pre-SPEC-25 behavior.
  if (Object.keys(frontmatter).length === 0) return null;

  frontmatter.blocks = frontmatter.blocks || null;
  frontmatter.blocked_by = frontmatter.blocked_by || null;

  return {
    frontmatter,
    body,
    filename: path.basename(filePath),
  };
}

/**
 * Load all tickets from a directory and its subdirectories.
 * @param {string} dirPath - Directory containing ticket .md files
 * @param {number} depth - Current recursion depth (default 0)
 * @returns {Array<{ frontmatter: Object, body: string, filename: string }>}
 */
function loadAllTickets(dirPath, depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const tickets = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && depth === 0) {
      // Scan subdirectories (inbox, open, complete, archive) one level deep
      tickets.push(...loadAllTickets(fullPath, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.md') && (entry.name.startsWith('KIMI-') || entry.name.startsWith('RCC-'))) {
      const ticket = loadTicket(fullPath);
      if (ticket) tickets.push(ticket);
    }
  }

  return tickets;
}

/**
 * Load sync.json from the issues panel.
 * @param {string} issuesDir - Path to the issues panel root
 * @returns {Object|null}
 */
function loadSync(issuesDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(issuesDir, 'sync.json'), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { loadTicket, loadAllTickets, loadSync };
