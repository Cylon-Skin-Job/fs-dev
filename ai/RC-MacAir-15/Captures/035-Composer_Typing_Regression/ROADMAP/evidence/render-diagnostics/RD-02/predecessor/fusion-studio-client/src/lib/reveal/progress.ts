/** Passive reveal measurements. Controllers write counters; consumers only pull copies. */
export type RevealPhase = 'shimmer' | 'revealing' | 'pacing' | 'waiting' | 'holding' | 'collapsing' | 'gap' | 'done';
export class RevealProgress {
  phase: RevealPhase = 'shimmer';
  /** Completed raw prefix only where known; never derived from display length. */
  sourceCursor: number | null = null;
  parserFedSource: number | null = null;
  readyChunks = 0;
  visible = 0;
  /** HTML units match html-utils (entities count once); display UTF16 is pre-tool-format text. */
  visibleUnit: 'html-visible-units' | 'display-UTF16' = 'display-UTF16';
  chunkTotal = 0;
  chunkVisible = 0;
  speedMs: number | null = null;
  batchSize: number | null = null;
  waitingSince: number | null = null;
  lastVisibleAt: number | null = null;
  received = () => 0;
  private changed: () => void;
  constructor(changed: () => void = () => {}) { this.changed = changed; }
  setPhase(phase: RevealPhase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.waitingSince = phase === 'waiting' ? Date.now() : null;
    this.changed();
  }
  advance(amount: number) {
    this.visible += amount;
    this.chunkVisible += amount;
    if (amount > 0) this.lastVisibleAt = Date.now();
  }
  directOutput(length: number) {
    if (this.visible !== length) this.advance(length - this.visible);
    this.chunkTotal = length;
  }
  snapshot() {
    return {
      phase: this.phase, receivedSource: this.received(), sourceUnit: 'UTF16' as const,
      sourceCursor: this.sourceCursor, parserFedSource: this.parserFedSource,
      readyChunks: this.readyChunks, visible: this.visible, visibleUnit: this.visibleUnit,
      chunkTotal: this.chunkTotal, chunkVisible: this.chunkVisible,
      speedMs: this.speedMs, batchSize: this.batchSize,
      waitingSince: this.waitingSince, lastVisibleAt: this.lastVisibleAt,
    };
  }
}

export interface RevealSurfaceIdentity {
  workspaceId?: string;
  threadId?: string;
  surfaceId: string;
  turnId?: string;
}
export class SurfaceRevealProgress {
  private records = new Map<number, { type: string; progress: RevealProgress }>();
  private frontier = 0;
  private phase: 'orb' | 'active' | 'terminal' | 'unmounted' = 'orb';
  private count = 0;
  waitingSince: number | null = null;
  readonly identity: RevealSurfaceIdentity;
  private changed: (since: number | null) => void;
  constructor(identity: RevealSurfaceIdentity, changed: (since: number | null) => void) {
    this.identity = identity;
    this.changed = changed;
  }
  segment(index: number, type: string, received: () => number) {
    let record = this.records.get(index);
    if (!record) {
      record = { type, progress: new RevealProgress(() => this.refresh()) };
      this.records.set(index, record);
    }
    record.progress.received = received;
    return record.progress;
  }
  update(phase: 'orb' | 'active' | 'terminal', frontier: number, count: number) {
    this.phase = phase;
    this.frontier = frontier;
    this.count = count;
    this.refresh();
  }
  private refresh() {
    const waiting = this.phase === 'active' && (this.frontier >= this.count
      || this.records.get(this.frontier)?.progress.phase === 'waiting');
    const since = waiting ? (this.waitingSince ?? Date.now()) : null;
    if (since !== this.waitingSince) {
      this.waitingSince = since;
      this.changed(since);
    }
  }
  dispose() { this.phase = 'unmounted'; this.waitingSince = null; }
  snapshot() {
    return { ...this.identity, phase: this.phase, frontier: this.frontier,
      waitingSince: this.waitingSince,
      segments: [...this.records].map(([index, { type, progress }]) => ({ index, type, ...progress.snapshot() })),
    };
  }
}
const mounted = new Set<SurfaceRevealProgress>();
/** No notification fanout, timers, retained transcripts or canonical state writes. */
export function readRevealSurfaces() { return [...mounted].map(surface => surface.snapshot()); }
export function registerRevealSurface(surface: SurfaceRevealProgress) {
  mounted.add(surface);
  return () => { mounted.delete(surface); surface.dispose(); };
}
