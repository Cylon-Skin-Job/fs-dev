#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const facts = collectFacts();
  const stableInputs = pickStableInputs(facts);
  const diagnosticInputs = pickDiagnosticInputs(facts);

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    givenName: args.name || null,
    slug: args.name ? slugify(args.name) : null,
    hostname: facts.hostname,
    platform: facts.platform,
    arch: facts.arch,
    stableFingerprint: sha256Json(stableInputs),
    diagnosticFingerprint: sha256Json(diagnosticInputs),
    stableInputs: redactObject(stableInputs, args.showSensitive),
    hardwareHints: redactObject({
      modelName: facts.modelName,
      modelIdentifier: facts.modelIdentifier,
      chip: facts.chip,
      cpuBrand: facts.cpuBrand,
      cpuCores: facts.cpuCores,
      memoryBytes: facts.memoryBytes,
      memoryHuman: facts.memoryHuman,
      hardwareUUID: facts.hardwareUUID,
      provisioningUDID: facts.provisioningUDID,
      platformUUID: facts.platformUUID,
      serialNumber: facts.serialNumber,
      boardId: facts.boardId,
    }, args.showSensitive),
    notes: [
      'Use stableFingerprint as a hardware matching hint, not as the permanent machine primary key.',
      'Generate and store an app-owned machine_id separately; bind it to the chosen givenName/slug and this fingerprint.',
      'Run with --show-sensitive to print raw serial/UUID fields.',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

function collectFacts() {
  const systemProfiler = parseSystemProfilerHardware(run('system_profiler', ['SPHardwareDataType']));
  const ioreg = parseIoregPlatform(run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']));
  const memBytes = Number(run('sysctl', ['-n', 'hw.memsize'])) || memoryBytesFromHuman(systemProfiler.Memory) || null;

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    modelName: systemProfiler['Model Name'] || null,
    modelIdentifier: systemProfiler['Model Identifier'] || run('sysctl', ['-n', 'hw.model']) || null,
    chip: systemProfiler.Chip || null,
    cpuBrand: run('sysctl', ['-n', 'machdep.cpu.brand_string']) || systemProfiler['Processor Name'] || systemProfiler.Chip || null,
    cpuCores: systemProfiler['Total Number of Cores'] || run('sysctl', ['-n', 'hw.ncpu']) || null,
    memoryBytes: memBytes,
    memoryHuman: systemProfiler.Memory || (memBytes ? `${Math.round(memBytes / 1024 / 1024 / 1024)} GB` : null),
    hardwareUUID: systemProfiler['Hardware UUID'] || null,
    provisioningUDID: systemProfiler['Provisioning UDID'] || null,
    platformUUID: ioreg.IOPlatformUUID || null,
    serialNumber: systemProfiler['Serial Number (system)'] || ioreg.IOPlatformSerialNumber || null,
    boardId: ioreg.boardId || null,
  };
}

function pickStableInputs(facts) {
  return {
    platform: facts.platform,
    arch: facts.arch,
    modelIdentifier: facts.modelIdentifier,
    hardwareUUID: facts.hardwareUUID || facts.platformUUID || null,
    provisioningUDID: facts.provisioningUDID || null,
    platformUUID: facts.platformUUID || facts.hardwareUUID || null,
    serialNumber: facts.serialNumber || null,
    boardId: facts.boardId || null,
  };
}

function pickDiagnosticInputs(facts) {
  return {
    ...pickStableInputs(facts),
    cpuBrand: facts.cpuBrand,
    chip: facts.chip,
    cpuCores: facts.cpuCores,
    memoryBytes: facts.memoryBytes,
    osRelease: facts.osRelease,
  };
}

function parseSystemProfilerHardware(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s{4,}([^:]+):\s*(.+?)\s*$/);
    if (!match) continue;
    out[match[1].trim()] = match[2].trim();
  }
  return out;
}

function parseIoregPlatform(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/"([^"]+)"\s*=\s*(?:"([^"]*)"|<([^>]*)>)/);
    if (!match) continue;
    const key = match[1];
    const value = match[2] || match[3] || '';
    if (key === 'IOPlatformUUID') out.IOPlatformUUID = value;
    if (key === 'IOPlatformSerialNumber') out.IOPlatformSerialNumber = value;
    if (key === 'board-id') out.boardId = value;
  }
  return out;
}

function memoryBytesFromHuman(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
  };
  return Math.round(amount * multipliers[unit]);
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).trim();
  } catch {
    return '';
  }
}

function sha256Json(value) {
  return crypto
    .createHash('sha256')
    .update(stableJson(value))
    .digest('hex');
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function redactObject(value, showSensitive) {
  if (showSensitive) return value;
  const sensitiveKeys = new Set(['hardwareUUID', 'provisioningUDID', 'platformUUID', 'serialNumber']);
  const out = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    out[key] = sensitiveKeys.has(key) ? redact(fieldValue) : fieldValue;
  }
  return out;
}

function redact(value) {
  if (!value) return null;
  const text = String(value);
  if (text.length <= 8) return 'REDACTED';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function slugify(value) {
  return String(value || 'local-machine')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'local-machine';
}

function parseArgs(argv) {
  const args = { name: null, showSensitive: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--show-sensitive') {
      args.showSensitive = true;
    } else if (arg === '--name') {
      args.name = argv[index + 1] || null;
      index += 1;
    }
  }
  return args;
}

main();
