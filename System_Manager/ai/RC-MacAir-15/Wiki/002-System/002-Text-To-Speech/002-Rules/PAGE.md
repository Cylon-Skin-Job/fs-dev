# Text-To-Speech Rules

The speech-to-text cleanup rule JSON is runtime data, not wiki navigation content.

Runtime rules now live at:

```text
System Source Files/resources/text-to-speech/rules/
```

The server resolves these through `fusion-studio-server/lib/resources/resolver.js` using `getTextToSpeechRulesRoot()`.

## Editing Boundary

- Edit the JSON files in the resource path when changing deterministic cleanup behavior.
- Do not place runtime JSON under `ai/views/wiki-viewer/Wiki/`.
- Do not edit cleanup runtime code unless the requested change cannot be represented by rule data.
