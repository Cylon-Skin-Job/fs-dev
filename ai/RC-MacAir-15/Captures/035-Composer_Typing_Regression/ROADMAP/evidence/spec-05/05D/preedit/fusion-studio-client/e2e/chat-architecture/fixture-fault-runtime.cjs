'use strict';

const fs = require('node:fs');

const GATE_OWNERS = Object.freeze({
  'before-admission': 'server',
  'after-admission': 'server',
  'before-ack': 'transport',
  'after-ack': 'transport',
  'before-dispatch': 'adapter',
  'after-dispatch': 'adapter',
  'before-turn-begin': 'adapter',
  'after-turn-begin': 'adapter',
  'before-stop': 'adapter',
  'after-stop': 'adapter',
  'before-save-ack': 'server',
  'after-save-ack': 'transport',
  'before-shutdown': 'adapter',
  'after-shutdown': 'adapter',
});

const gateCounts = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSchedule() {
  if (!process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE) return {};
  const parsed = JSON.parse(process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('fault schedule must be an object');
  }
  for (const [gate, instruction] of Object.entries(parsed)) {
    if (!GATE_OWNERS[gate]) throw new Error(`unknown fault gate: ${gate}`);
    if (!instruction || !['throw', 'delay', 'drop'].includes(instruction.action)) {
      throw new Error(`invalid fault instruction at ${gate}`);
    }
    if (instruction.action === 'drop' && GATE_OWNERS[gate] !== 'transport') {
      throw new Error(`drop is only valid at transport gates, not ${gate}`);
    }
    if (instruction.occurrence !== undefined
      && (!Number.isInteger(instruction.occurrence) || instruction.occurrence < 1)) {
      throw new Error(`invalid occurrence at ${gate}`);
    }
  }
  return parsed;
}

function appendEvent(event) {
  const target = process.env.FUSION_CHAT_ARCH_ADAPTER_LOG;
  if (!target) return;
  fs.appendFileSync(target, `${JSON.stringify({ at: Date.now(), ...event })}\n`);
}

async function evaluateGate(schedule, gate, expectedOwner) {
  const owner = GATE_OWNERS[gate];
  if (!owner) throw new Error(`unknown fault gate: ${gate}`);
  if (owner !== expectedOwner) {
    throw new Error(`fault gate ${gate} belongs to ${owner}, not ${expectedOwner}`);
  }
  const occurrence = (gateCounts.get(gate) || 0) + 1;
  gateCounts.set(gate, occurrence);
  appendEvent({ type: 'gate', gate, owner, occurrence });
  const instruction = schedule[gate];
  if (!instruction || (instruction.occurrence && instruction.occurrence !== occurrence)) return null;
  if (instruction.action === 'delay') {
    await delay(Math.max(0, Math.min(90_000, Number(instruction.delayMs) || 0)));
    return { delayed: true, gate, owner, occurrence };
  }
  if (instruction.action === 'drop') return { dropped: true, gate, owner, occurrence };
  throw new Error(`deterministic ${owner} fault at ${gate}`);
}

function resetGateCounts() {
  gateCounts.clear();
}

module.exports = {
  GATE_OWNERS,
  evaluateGate,
  parseSchedule,
  resetGateCounts,
};
