/**
 * ChatFile - Parser and writer for thread markdown files
 *
 * Writes human-readable chat transcript mirrors to the workspace machine data
 * folder:
 *   ai/<machine>/Data/Chatlogs/threads/<threadId>.md
 *
 * Filenames are the timestamp thread ID (from SPEC-24a) and are IMMUTABLE
 * for the life of the file. Renaming a thread is a frontmatter rewrite,
 * not a filesystem move. Display name lives in YAML frontmatter at the
 * top of the file (SPEC-24b).
 */

const fs = require('fs').promises;
const path = require('path');

const TOOL_CALL_MARKER = '**TOOL CALL(S)**';

class ChatFile {
  /**
   * @param {object} opts
   * @param {string} opts.chatlogDir - Absolute path to the chatlog threads directory.
   * @param {string} opts.threadId - Timestamp thread ID (YYYY-MM-DDTHH-MM-SS-mmm)
   *   from SPEC-24a. Becomes the filename: ${threadId}.md — immutable for the
   *   life of the file. Rename is a frontmatter operation, not a filesystem one.
   */
  constructor(opts = {}) {
    const { chatlogDir, threadId } = opts;
    if (!chatlogDir || !threadId) {
      throw new Error('ChatFile: both chatlogDir and threadId are required');
    }
    this.chatlogDir = chatlogDir;
    this.threadId = threadId;
    this.filePath = path.join(chatlogDir, `${threadId}.md`);
  }

  /**
   * Ensure the parent directory exists
   */
  async ensureDir() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  /**
   * Parse a chat markdown file into frontmatter + messages.
   * @param {string} content - Full file content
   * @returns {{name: string|null, messages: Array}}
   */
  parse(content) {
    const { parseFrontmatter } = require('../frontmatter');
    const { frontmatter, body } = parseFrontmatter(content, 'chat');

    // name may be null (fresh thread before enrichment), undefined (file has
    // no frontmatter — treat as null), or a string.
    const name = frontmatter.name === undefined ? null : frontmatter.name;

    const lines = body.split('\n');
    const messages = [];
    let currentRole = null;
    let currentContent = [];
    let currentHasToolCalls = false;
    let currentMetadata = null;

    const flushMessage = () => {
      if (currentRole && currentContent.length > 0) {
        const msg = {
          role: currentRole,
          content: currentContent.join('\n').trim(),
          hasToolCalls: currentHasToolCalls
        };
        if (currentMetadata) {
          msg.metadata = currentMetadata;
        }
        messages.push(msg);
      }
      currentContent = [];
      currentHasToolCalls = false;
      currentMetadata = null;
    };

    for (const line of lines) {
      if (line === 'User') {
        flushMessage();
        currentRole = 'user';
      } else if (line === 'Assistant') {
        flushMessage();
        currentRole = 'assistant';
      } else if (line === TOOL_CALL_MARKER) {
        currentHasToolCalls = true;
      } else if (line.startsWith('<!-- metadata:') && line.endsWith('-->')) {
        // Parse metadata HTML comment
        try {
          const jsonStart = line.indexOf('{');
          const jsonEnd = line.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            currentMetadata = JSON.parse(line.slice(jsonStart, jsonEnd + 1));
          }
        } catch {
          // Ignore parse errors for malformed metadata
        }
      } else if (currentRole) {
        currentContent.push(line);
      }
    }

    flushMessage();
    return { name, messages };
  }

  /**
   * Serialize frontmatter + messages to markdown format.
   * @param {string|null} name - Display name. null is emitted as `name: null`
   *   in the frontmatter and round-trips through the parser as JS null.
   * @param {Array} messages
   * @returns {string}
   */
  serialize(name, messages) {
    const { serializeFrontmatter } = require('../frontmatter');
    const fm = serializeFrontmatter({ name });

    const lines = [''];  // blank line after frontmatter block

    for (const msg of messages) {
      lines.push(msg.role === 'user' ? 'User' : 'Assistant');
      lines.push('');
      lines.push(msg.content);
      lines.push('');

      if (msg.hasToolCalls) {
        lines.push(TOOL_CALL_MARKER);
        lines.push('');
      }

      // Add metadata as HTML comment after assistant messages
      if (msg.role === 'assistant' && msg.metadata && Object.keys(msg.metadata).length > 0) {
        lines.push(`<!-- metadata: ${JSON.stringify(msg.metadata)} -->`);
        lines.push('');
      }
    }

    return fm + lines.join('\n');
  }

  /**
   * Read and parse the chat file
   * @returns {Promise<{name: string|null, messages: Array}|null>}
   */
  async read() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return this.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Read the primary chatlog mirror file.
   * @returns {Promise<{name: string|null, messages: Array}|null>}
   */
  async readPrimary() {
    return this.read();
  }

  /**
   * Write messages to file
   * @param {string|null} name
   * @param {Array} messages
   */
  async write(name, messages) {
    await this.ensureDir();
    const content = this.serialize(name, messages);
    await fs.writeFile(this.filePath, content);
  }

  /**
   * Check if the file exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get message count
   * @returns {Promise<number>}
   */
  async countMessages() {
    const parsed = await this.read();
    return parsed?.messages.length || 0;
  }

}

module.exports = { ChatFile, TOOL_CALL_MARKER };
