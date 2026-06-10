# Capability Layer And Gwen One-Shot Spec

## Objective

Create a modular server-side capability layer that can run reusable one-shot jobs through local or external providers.

Initial use case:

```text
Whisper transcript
→ Gwen/Qwen 0.8B one-shot cleanup
→ cleaned text inserted into chat input
```

Future use cases:

```text
thread messages → Gwen/Qwen → thread title
chat context → Gwen/Qwen → context-shaping text
prompt → Nano Banana → image
query → Perplexity → research result
text → local embedding model → embedding vector
```

## Standards Alignment

This design follows the code standards page at `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`:

- One job per file.
- No god file.
- Extract only because there are already multiple expected consumers: STT cleanup, thread naming, context shaping, and future external providers.
- Capabilities are backend services, not client concerns.
- Views/components only trigger warm/run requests; they do not know model/provider details.
- Prompts live outside JS so behavior can change without editing code.

## Prompt Location

Prompts live here:

```text
System Source Files/Prompts/Gwen-0-8B/
  STT_PROMPT.md
  THREADS_PROMPT.md
  CONTEXT_PROMPT.md
```

Prompt files are self-contained. Vocabulary corrections are included directly in the relevant prompt, especially `STT_PROMPT.md`.

No separate `VOCABULARY.md`.

## Proposed Server Structure

```text
fusion-studio-server/lib/capabilities/
  index.js
  registry.js
  runner.js
  prompt-loader.js
  warm-service.js
  providers/
    transformers-js.js
    openai.js          future
    anthropic.js       future
    perplexity.js      future
    nano-banana.js     future
```

Initial implementation only needs:

```text
fusion-studio-server/lib/capabilities/
  index.js
  registry.js
  runner.js
  prompt-loader.js
  warm-service.js
  providers/
    transformers-js.js
```

## File Jobs

`index.js`

Public API only. Exports `warmCapability`, `runCapability`, and possibly `getCapabilityStatus`.

`registry.js`

Defines capability config and model/provider config. No runtime logic.

`runner.js`

Runs a capability by name. Loads prompt, resolves provider, calls provider adapter, normalizes result.

`prompt-loader.js`

Reads markdown prompt files from `System Source Files/Prompts/Gwen-0-8B/`. Handles path resolution and file-not-found errors.

`warm-service.js`

Idempotent warm orchestration. If warm is already complete, do nothing. If warm is in progress, return the existing promise.

`providers/transformers-js.js`

Owns `@huggingface/transformers` import, pipeline creation, singleton cache, generation call, and eventual dispose hook.

## Capability Registry Shape

```js
const CAPABILITIES = {
  sttCleanup: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'STT_PROMPT.md',
    maxNewTokens: 256,
    temperature: 0,
  },

  threadTitle: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'THREADS_PROMPT.md',
    maxNewTokens: 48,
    temperature: 0.2,
  },

  contextShaping: {
    type: 'one-shot-text',
    provider: 'transformers-js',
    model: 'gwen-0-8b',
    promptFile: 'CONTEXT_PROMPT.md',
    maxNewTokens: 512,
    temperature: 0,
  },
};
```

Model config:

```js
const MODELS = {
  'gwen-0-8b': {
    provider: 'transformers-js',
    modelId: 'onnx-community/Qwen3.5-0.8B-Text-ONNX',
    task: 'text-generation',
    device: 'webgpu',
    dtype: 'q4f16',
  },
};
```

If WebGPU is unreliable in Node on the target machine, fallback should be handled through model/runtime config, not consumer code.

## Public API

```js
await warmCapability('sttCleanup');

const result = await runCapability('sttCleanup', {
  input: rawTranscript,
});
```

Return shape:

```js
{
  success: true,
  text: 'cleaned transcript',
  capability: 'sttCleanup',
  model: 'gwen-0-8b',
  provider: 'transformers-js'
}
```

Failure shape:

```js
{
  success: false,
  error: 'message',
  capability: 'sttCleanup',
  fallbackText: rawTranscript
}
```

## Warm-Up Policy

Gwen/Qwen warm triggers:

```text
mic modal opens
chat input focus
paste into chat input
thread rename job starts
context shaping job starts
```

Behavior:

```text
first trigger → load model
trigger during load → await same promise
trigger after ready → return immediately
```

Default policy:

```text
keep model warm for Node process lifetime
```

No idle unload in the first version. Add a `dispose` hook only so future memory policy can be added cleanly.

## Whisper Warm-Up

Add a warm endpoint for voice:

```text
POST /api/transcription/warm
```

It should:

```text
warm Whisper setup
warm sttCleanup capability
return statuses
```

Current Whisper uses `nodejs-whisper`, so warming may not keep the actual model fully resident like Transformers.js does. It can still initialize dependencies, confirm/download model files, build/check `whisper-cli`, and prime the path before the audio upload arrives.

## HTTP Endpoints

Generic capability warm:

```text
POST /api/capabilities/warm
```

Request:

```json
{
  "capability": "sttCleanup"
}
```

Response:

```json
{
  "success": true,
  "capability": "sttCleanup",
  "status": "ready"
}
```

Voice-specific warm:

```text
POST /api/transcription/warm
```

Used by mic modal open.

Optional future generic run endpoint should not be added yet unless needed. Internal server modules can call `runCapability()` directly.

## STT Integration

Current location:

```text
fusion-studio-server/lib/transcription/index.js
```

Current flow:

```js
const result = await transcribeAudio(filePath, ...);
const text = extractText(result, 'txt');
res.json({ success: true, text, ... });
```

New flow:

```text
transcribe audio
extract raw text
run sttCleanup capability
return cleaned text
include rawText for debugging if desired
fallback to raw text if cleanup fails
```

Failure rule:

```text
Gwen cleanup must never make Whisper transcription fail.
```

If local cleanup fails:

```json
{
  "success": true,
  "text": "raw transcript",
  "rawText": "raw transcript",
  "cleanup": {
    "success": false,
    "error": "..."
  }
}
```

## Prompt Contract

`STT_PROMPT.md` should instruct:

```text
Do not use tools.
Do not answer the user.
Do not add facts.
Only clean the transcript.
Fix punctuation, casing, spacing, and obvious speech-to-text errors.
Use vocabulary corrections when context makes them likely.
If the speaker is listing items, preserve or create a clear bullet list.
Return only the cleaned transcript.
```

`THREADS_PROMPT.md` should instruct:

```text
Return only a short thread title.
No punctuation unless necessary.
No explanation.
```

`CONTEXT_PROMPT.md` can be defined later.

## Secrets

Initial Transformers.js local provider needs no secret.

Future provider adapters should use the existing Secrets Manager. The capability registry can declare required secret names, but provider adapters should fetch them.

Example future config:

```js
deepSearch: {
  type: 'search',
  provider: 'perplexity',
  secret: 'PERPLEXITY_API_KEY',
}
```

## Client Responsibilities

Client should not know Gwen/Qwen, model IDs, prompts, or provider names.

Client can call product-level warm endpoints:

```text
mic modal open → POST /api/transcription/warm
chat input focus/paste → POST /api/capabilities/warm { capability: "contextShaping" }
```

The recorder still calls:

```text
POST /api/transcribe
```

No UI changes are required for the first cleanup integration beyond warm-up triggers.

## Non-Goals For First Slice

- No AI-callable tool exposure yet.
- No Perplexity adapter yet.
- No Nano Banana adapter yet.
- No embeddings yet.
- No idle unload policy yet.
- No generic public `run capability` endpoint unless an immediate caller needs it.
- No prompt editor UI.
- No external API provider implementation.

## First Implementation Slice

1. Add prompt files under `System Source Files/Prompts/Gwen-0-8B/`.
2. Add `@huggingface/transformers` to server.
3. Add `lib/capabilities/` with only Transformers.js provider.
4. Add idempotent warm support.
5. Add `sttCleanup` capability.
6. Add `POST /api/transcription/warm`.
7. Wire transcription cleanup after Whisper with raw-text fallback.
8. Add client warm call when mic modal opens.
9. Verify first transcription works and failed cleanup still returns raw transcript.
