/**
 * @module export/submodules/documents
 * @role Markdown / DOCX document → PDF export
 *
 * Pipeline: markdown → Pandoc → HTML5 → pdf-engine → PDF
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { htmlToPdf } = require('../../pdf-engine.cjs');

function createDocumentSubmodule({ getPandocPath }) {
  return {
    async export({ sourceFormat, content }) {
      if (sourceFormat === 'markdown') {
        return exportMarkdownToPdf(content, getPandocPath);
      }
      throw new Error(`Unsupported document source format: ${sourceFormat}`);
    },
  };
}

async function exportMarkdownToPdf(markdown, getPandocPath) {
  const pandocPath = getPandocPath();
  if (!pandocPath) {
    throw new Error('Pandoc not found in bundle');
  }

  const uid = crypto.randomBytes(6).toString('hex');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-export-'));
  const tmpInput = path.join(tmpDir, `input-${uid}.md`);
  const tmpOutput = path.join(tmpDir, `output-${uid}.html`);

  fs.writeFileSync(tmpInput, markdown ?? '', 'utf8');

  const cleanup = () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return new Promise((resolve, reject) => {
    const proc = spawn(pandocPath, [
      tmpInput,
      '-t', 'html5',
      '--standalone',
      '-o', tmpOutput,
    ]);

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('error', (err) => {
      cleanup();
      reject(new Error(err.message));
    });

    proc.on('close', async (code) => {
      if (code !== 0 || !fs.existsSync(tmpOutput)) {
        cleanup();
        reject(new Error((stderr || 'Pandoc failed').trim()));
        return;
      }

      try {
        let html = fs.readFileSync(tmpOutput, 'utf8');
        // Inject print-friendly CSS: control page margins via @page,
        // remove Pandoc's body padding so we don't double-margin.
        const injectedStyle = `<style>
          @page { margin: 0.25in 0.5in 0.5in 0.5in; size: letter; }
          body { margin: 0; padding: 0; max-width: none !important; }
          h1 { margin-top: 0; font-size: 1.25em; }
          h2 { font-size: 1.15em; }
          h3 { font-size: 1.05em; }
        </style>`;
        html = html.replace('</head>', `${injectedStyle}</head>`);
        const pdfBuffer = await htmlToPdf(html);
        resolve(pdfBuffer);
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    });
  });
}

module.exports = { createDocumentSubmodule };
