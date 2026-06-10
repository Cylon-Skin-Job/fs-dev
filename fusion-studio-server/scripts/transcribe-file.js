#!/usr/bin/env node
/**
 * Standalone script to transcribe an audio file using the Whisper module.
 *
 * Usage:
 *   node scripts/transcribe-file.js <path-to-audio-file> [output.txt]
 */

const path = require('path');
const fs = require('fs');

// Ensure we resolve dependencies from the server directory
process.chdir(path.resolve(__dirname, '..'));

const transcription = require('../lib/transcription');

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputFile) {
    console.error('Usage: node scripts/transcribe-file.js <path-to-audio-file> [output.txt]');
    process.exit(1);
  }

  const absolutePath = path.resolve(inputFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Transcribing: ${absolutePath}`);
  console.log('Initializing Whisper model (first run may take a while)...');

  await transcription.initWhisper();

  console.log('Running transcription...');
  const result = await transcription.transcribeAudio(absolutePath, {
    language: 'auto',
    outputFormat: 'txt'
  });

  // Replicate extractText logic since it's not exported
  let text = '';
  if (typeof result === 'string') {
    text = result;
  } else {
    text = result.text || result.toString() || '';
  }

  // Strip timestamp tags and normalize whitespace
  text = text
    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('\n--- TRANSCRIPTION ---\n');
  console.log(text);
  console.log('\n--- END ---\n');

  if (outputFile) {
    const outPath = path.resolve(outputFile);
    fs.writeFileSync(outPath, text, 'utf-8');
    console.log(`Saved to: ${outPath}`);
  }
}

main().catch(err => {
  console.error('Transcription failed:', err.message);
  process.exit(1);
});
