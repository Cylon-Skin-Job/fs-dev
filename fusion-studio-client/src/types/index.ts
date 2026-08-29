/**
 * @module types
 * @role Compatibility re-export hub.
 *
 * SPEC-04 Slice A split the former monolithic type surface into focused
 * modules by domain: chat (messages/segments/panel state/live snapshot),
 * websocket (legacy wire union + broad ingress bag), chat-wire (routed
 * required-shape chat contracts + diagnostics), workspace
 * (registry/templates/CLI catalog/threads/harness status), and view-state
 * (panes/layout/theme/timing).
 *
 * Every existing importer of `../types` / `../../types` keeps compiling
 * unchanged through these re-exports. New code may import directly from the
 * owning module. Names across the five modules are disjoint by design so the
 * star re-exports never conflict.
 */

export * from './chat';
export * from './websocket';
export * from './chat-wire';
export * from './workspace';
export * from './view-state';
