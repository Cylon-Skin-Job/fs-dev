/**
 * @module types/index
 * @role Compatibility barrel for the renderer's decomposed type domains.
 *
 * SPEC-04 ownership split:
 *   chat.ts       — chat history, stream snapshots, tool/turn metadata
 *   websocket.ts  — legacy broad wire surface
 *   chat-wire.ts  — typed routed REQUIRED-shape chat contracts
 *   workspace.ts  — workspace, harness catalog, palette state
 *   view-state.ts — view/activity/collection/UI state and remaining shell types
 *
 * Existing importers of `../types` and `../../types` keep compiling through
 * these re-exports. Provenance-specific resource protocol contracts are owned
 * by `types/file-explorer.ts` and imported directly by their handlers.
 */

export * from './chat';
export * from './websocket';
export * from './chat-wire';
export * from './workspace';
export * from './view-state';
