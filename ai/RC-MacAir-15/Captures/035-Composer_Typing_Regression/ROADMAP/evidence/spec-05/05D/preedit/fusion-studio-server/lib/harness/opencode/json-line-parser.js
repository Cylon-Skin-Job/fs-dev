const { EventEmitter } = require('events');

class JsonLineParser extends EventEmitter {
  constructor() {
    super();
    this.buffer = '';
    this.lineNumber = 0;
  }

  feed(chunk) {
    this.buffer += String(chunk || '');
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.parseLine(line);
    }
  }

  flush() {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return;
    }
    this.parseLine(this.buffer);
    this.buffer = '';
  }

  parseLine(line) {
    this.lineNumber += 1;
    const trimmed = String(line || '').trim();
    if (!trimmed) return;

    try {
      this.emit('message', JSON.parse(trimmed));
    } catch (err) {
      this.emit('parse_error', trimmed, err, this.lineNumber);
    }
  }
}

module.exports = { JsonLineParser };
