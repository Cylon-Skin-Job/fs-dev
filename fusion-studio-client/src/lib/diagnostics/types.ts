export interface DiagnosticTarget {
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
}
export interface NativeDiagnosticEvent {
  seq: number;
  text: string;
  sourceUnits: number;
  sourceBytes: number;
  count?: number;
  redacted?: boolean;
  dropped?: boolean;
}
export interface DiagnosticStreamFrame {
  type: 'chat-turn:diagnostic:stream';
  subscriptionId: string;
  workspaceId: string;
  threadId: string;
  availability: 'available' | 'unavailable' | 'unsupported' | 'idle';
  turnId?: string | null;
  generation?: number;
  drainId?: string | null;
  terminal?: boolean;
  reset?: boolean;
  baseline?: number;
  dropped?: number;
  events?: NativeDiagnosticEvent[];
}
