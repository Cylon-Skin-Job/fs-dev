/**
 * @module transcription
 * @role Self-hosted Whisper V3 transcription service
 * @description Standalone voice transcription module using nodejs-whisper
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { emit } = require('../event-bus');
const { applyDeterministicCleanup } = require('./deterministic-cleanup');

// Lazy-load nodejs-whisper only when needed
let nodewhisper = null;
let modelReady = false;
let modelLoading = false;
let modelLoadPromise = null;

const DEFAULT_MODEL = 'large-v3-turbo';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Temp directory for audio uploads
const tempDir = path.join(os.tmpdir(), 'kimi-transcription');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${uniqueName}.webm`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-matroska'];
    // Accept audio types, video types (webm), or application/octet-stream (some browsers send this)
    if (allowedTypes.includes(file.mimetype) || 
        file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/') ||
        file.mimetype === 'application/octet-stream' ||
        file.originalname.endsWith('.webm')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * Resolve the path to the nodejs-whisper package root so we can locate
 * the models directory and the whisper-cli binary.
 */
function getWhisperCppPath() {
  const nodejsWhisperMain = require.resolve('nodejs-whisper');
  return path.join(path.dirname(nodejsWhisperMain), '..', 'cpp', 'whisper.cpp');
}

/**
 * Check if whisper-cli binary exists in any of the expected build locations.
 */
function findWhisperCli(whisperCppPath) {
  const candidates = [
    path.join(whisperCppPath, 'build', 'bin', 'whisper-cli'),
    path.join(whisperCppPath, 'build', 'bin', 'Release', 'whisper-cli.exe'),
    path.join(whisperCppPath, 'build', 'whisper-cli'),
    path.join(whisperCppPath, 'whisper-cli'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Initialize the whisper model (lazy loading).
 *
 * nodejs-whisper expects the model to live inside its own package tree:
 *   node_modules/nodejs-whisper/cpp/whisper.cpp/models/
 *
 * We also verify that whisper-cli has been built. If the model is cached in
 * ~/.whisper/ we copy (or hard-link) it into place instead of re-downloading.
 */
async function initWhisper() {
  if (modelReady) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoading = true;
  console.log('[Transcription] Initializing Whisper model...');

  modelLoadPromise = (async () => {
    const whisper = require('nodejs-whisper');
    nodewhisper = whisper.nodewhisper;

    const whisperCppPath = getWhisperCppPath();
    const modelsDir = path.join(whisperCppPath, 'models');
    const modelFileName = `ggml-${DEFAULT_MODEL}.bin`;
    const correctModelPath = path.join(modelsDir, modelFileName);

    // 1. Ensure model exists where nodejs-whisper expects it
    if (!fs.existsSync(correctModelPath)) {
      const fallbackModelPath = path.join(os.homedir(), '.whisper', modelFileName);

      if (fs.existsSync(fallbackModelPath)) {
        console.log(`[Transcription] Copying model from ${fallbackModelPath}...`);
        fs.mkdirSync(modelsDir, { recursive: true });
        try {
          fs.linkSync(fallbackModelPath, correctModelPath);
          console.log('[Transcription] Hard-linked model into nodejs-whisper models dir');
        } catch {
          fs.copyFileSync(fallbackModelPath, correctModelPath);
          console.log('[Transcription] Copied model into nodejs-whisper models dir');
        }
      } else {
        console.log(`[Transcription] Downloading ${DEFAULT_MODEL} model...`);
        const { execSync } = require('child_process');
        execSync(`npx nodejs-whisper download ${DEFAULT_MODEL}`, { stdio: 'inherit' });
      }
    }

    // 2. Ensure whisper-cli binary exists
    const cliPath = findWhisperCli(whisperCppPath);
    if (!cliPath) {
      console.log('[Transcription] whisper-cli not found — building whisper.cpp...');
      const { execSync } = require('child_process');
      execSync('cmake -B build', { cwd: whisperCppPath, stdio: 'inherit' });
      execSync('cmake --build build --config Release', { cwd: whisperCppPath, stdio: 'inherit' });
      if (!findWhisperCli(whisperCppPath)) {
        throw new Error('whisper-cli binary still missing after build');
      }
      console.log('[Transcription] whisper-cli built successfully');
    }

    modelReady = true;
    console.log('[Transcription] Whisper model ready');
  })();

  try {
    await modelLoadPromise;
  } catch (error) {
    console.error('[Transcription] Failed to initialize Whisper:', error.message);
    throw error;
  } finally {
    modelLoading = false;
    modelLoadPromise = null;
  }
}

/**
 * Transcribe audio file using Whisper
 */
async function transcribeAudio(filePath, options = {}) {
  if (!modelReady) {
    await initWhisper();
  }

  const {
    language = 'auto',
    outputFormat = 'txt'
  } = options;

  const whisperOptions = {
    outputInText: outputFormat === 'txt',
    outputInJson: outputFormat === 'json',
    outputInSrt: outputFormat === 'srt',
    language: language === 'auto' ? undefined : language,
  };

  const result = await nodewhisper(filePath, {
    modelName: DEFAULT_MODEL,
    removeWavFileAfterTranscription: false, // We handle cleanup
    whisperOptions,
  });

  return result;
}

/**
 * Extract plain text from Whisper output
 * Removes timestamp tags like [00:00:00.000 --> 00:00:02.000]
 */
function extractText(result, format = 'txt') {
  let text = '';
  
  if (typeof result === 'string') {
    text = result;
  } else if (format === 'json' && result.json) {
    try {
      const data = JSON.parse(result.json);
      text = data.text || '';
    } catch {
      text = '';
    }
  } else {
    text = result.text || result.toString() || '';
  }
  
  // Remove timestamp tags: [00:00:00.000 --> 00:00:02.000]
  text = text.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '');
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Cleanup temp files
 */
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('[Transcription] Cleanup failed:', error.message);
  }
}

/**
 * Create Express router with transcription routes
 */
function createRouter() {
  const router = express.Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: modelReady ? 'ready' : modelLoading ? 'loading' : 'not_initialized',
      model: DEFAULT_MODEL
    });
  });

  router.post('/transcription/warm', async (req, res) => {
    try {
      await initWhisper();
      res.json({
        success: true,
        whisper: { status: 'ready', model: DEFAULT_MODEL },
        cleanup: { success: true, status: 'deterministic', skippedModel: true },
      });
    } catch (error) {
      console.error('[Transcription] Warm failed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Main transcription endpoint
  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const filePath = req.file?.path;

    if (!filePath) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size < 1024) {
        console.warn('[Transcription] Rejected tiny audio file:', req.file.originalname, stats.size, 'bytes');
        return res.status(400).json({ error: 'Audio file too small or empty. Please record again.' });
      }

      console.log('[Transcription] Processing:', req.file.originalname, `(${stats.size} bytes)`);

      const result = await transcribeAudio(filePath, {
        language: req.body.language || 'auto',
        outputFormat: 'txt'
      });

      const rawText = extractText(result, 'txt');
      const deterministic = applyDeterministicCleanup(rawText);
      const text = deterministic.text;
      const cleanup = {
        success: true,
        skippedModel: true,
        deterministicChanges: deterministic.changes,
        needsSelfCorrectionPass: deterministic.needsSelfCorrectionPass,
        needsListBoundaryPass: deterministic.needsListBoundaryPass,
      };

      emit('transcription:completed', {
        rawText,
        correctedText: text,
        cleanup,
        whisperModel: DEFAULT_MODEL,
        durationMs: req.body.duration == null ? null : Number(req.body.duration),
      });

      res.json({
        success: true,
        text,
        rawText,
        cleanup,
        model: DEFAULT_MODEL,
        duration: req.body.duration || null
      });

    } catch (error) {
      console.error('[Transcription] Error:', error.message);
      res.status(500).json({
        error: 'Transcription failed',
        message: error.message
      });
    } finally {
      cleanup(filePath);
    }
  });

  return router;
}

module.exports = {
  createRouter,
  initWhisper,
  transcribeAudio,
  DEFAULT_MODEL
};
