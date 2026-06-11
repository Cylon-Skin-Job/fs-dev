/**
 * Capabilities HTTP routes.
 *
 * Capability warm-up plus STT prompt read/write.
 * Mounted at /api/capabilities in server.js.
 */

const express = require('express');

function createRouter() {
  const router = express.Router();

  router.post('/warm', async (req, res) => {
    const { warmCapability } = require('../capabilities');
    const capability = req.body?.capability;

    if (!capability) {
      return res.status(400).json({ success: false, error: 'Missing capability' });
    }

    try {
      const result = await warmCapability(capability);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, capability, error: error.message });
    }
  });

  router.get('/prompts/stt', async (req, res) => {
    const { loadPrompt } = require('../capabilities/prompt-loader');

    try {
      const prompt = await loadPrompt('STT_PROMPT.md');
      res.json({ success: true, prompt });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/prompts/stt', async (req, res) => {
    const { savePrompt } = require('../capabilities/prompt-loader');
    const prompt = req.body?.prompt;

    if (typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing prompt' });
    }

    try {
      await savePrompt('STT_PROMPT.md', prompt);
      res.json({ success: true, prompt });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { createRouter };
