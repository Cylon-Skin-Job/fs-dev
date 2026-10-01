/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
/**
 * LiveSegmentRenderer — Two-phase rendering for live streaming turns.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ PHASE 1: ORB (gatekeeper)                                  │
 * │                                                             │
 * │ The orb is NOT part of the chat render pipeline.            │
 * │ It runs a fixed 2-second animation (expand → hold →        │
 * │ collapse). When it finishes, it's removed. Only THEN does  │
 * │ Phase 2 begin. This buys 500-800ms of lead time for the    │
 * │ first token to arrive from the API.                         │
 * │                                                             │
 * │ If the API hasn't responded in 2s, we likely have a        │
 * │ connection issue — that's a separate concern.               │
 * ├─────────────────────────────────────────────────────────────┤
 * │ PHASE 2: SEGMENT RENDER                                    │
 * │                                                             │
 * │ Segments animate one at a time:                             │
 * │ 1. ToolCallBlock appears (icon + label shimmer)             │
 *   │ 2. Content typing blitz (speed from queue lookahead)        │
 * │ 3. Post-typing pause                                        │
 * │ 4. Collapse animation                                       │
 * │ 5. Next segment starts                                      │
 * │                                                             │
 * │ Text segments use paragraph/header chunk parsing.           │
 * │ No render engine — self-manages timing.                     │
 * └─────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import type { StreamSegment, TurnActivity } from '../types';
import { getToolRenderer } from '../lib/tool-renderers';
import type { TimingProfile } from '../lib/timing';
import { DEFAULT_TIMING_PROFILE } from '../lib/timing';
import { animateTool } from '../lib/tool-animate';
import { renderTextInstant } from '../lib/text';
import { animateText } from '../lib/text/text-animate';
import { ToolCallBlock } from './ToolCallBlock';
import { Orb } from './Orb';
import { HourglassFlow } from './chat/HourglassFlow';
import { VisibleWaitActivity } from './chat/VisibleWaitActivity';
import { SurfaceRevealProgress, registerRevealSurface, type RevealProgress } from '../lib/reveal/progress';
import './LiveSegmentRenderer.css';

interface TimingProbe {
  sendAt?: number;
  orbEndAt?: number;
  firstTokenAt?: number;
}



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LiveSegmentRendererProps {
  workspaceId?: string;
  threadId?: string;
  surfaceId?: string;
  terminal?: boolean;
  turnId?: string;
  segments: StreamSegment[];
  onRevealComplete?: () => void;
  /**
   * Canonical step activity still starts the existing orb disposal.
   * Visible-wait eligibility and elapsed time belong to this mounted surface.
   */
  activity?: TurnActivity | null;
}

export function LiveSegmentRenderer(props: LiveSegmentRendererProps) {
  // A replacement turn owns a fresh frontier and retires every old continuation.
  return <LiveTurnSegments key={JSON.stringify([props.workspaceId, props.threadId, props.surfaceId, props.turnId])} {...props} />;
}

function LiveTurnSegments({ turnId, workspaceId, threadId, surfaceId, terminal, segments, onRevealComplete, activity }: LiveSegmentRendererProps) {
  const fallbackSurfaceId = useId();
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [observation] = useState(() => new SurfaceRevealProgress({ workspaceId, threadId, surfaceId: surfaceId ?? fallbackSurfaceId, turnId }, setWaitingSince));
  const [orbDone, setOrbDone] = useState(false);
  const [orbDisposing, setOrbDisposing] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  useEffect(() => registerRevealSurface(observation), [observation]);
  useEffect(() => {
    observation.update(terminal || onRevealComplete ? 'terminal' : orbDone ? 'active' : 'orb', revealedCount, segments.length);
  }, [observation, terminal, onRevealComplete, orbDone, revealedCount, segments.length]);
  const prevLenRef = useRef(0);
  const hasTokenRef = useRef(false);
  const finalizedRef = useRef(false);
  const lastRenderableRef = useRef(-1);
  lastRenderableRef.current = segments.reduce((last, seg, i) =>
    seg.type !== 'text' || seg.content.length > 0 ? i : last, -1);
  const hasQueuedItemAfter = useCallback((index: number) => lastRenderableRef.current > index, []);

  useEffect(() => {
    setOrbDone(false);
    setOrbDisposing(false);
    setRevealedCount(0);
    prevLenRef.current = 0;
    hasTokenRef.current = false;
    finalizedRef.current = false;
  }, [turnId]);

  // ── Phase 1: Watch for first token or step activity → trigger orb disposal ──
  // SPEC-05 Slice A (§4.4): a routed step_begin IS activity and starts orb
  // disposal using the current animation path. No-step turns keep the
  // existing orb-until-output trigger. If renderable output arrives during
  // disposal, the revision-gated clear nulls the activity, so Working can
  // never flash when the orb completes.
  useEffect(() => {
    if (hasTokenRef.current || orbDone) return;

    const firstSegment = segments[0];
    const hasRenderableSegment = Boolean(firstSegment) && (
      firstSegment.type !== 'text' ||
      firstSegment.content.length > 0
    );
    const hasTurnActivity = Boolean(activity && turnId && activity.turnId === turnId);
    if (hasRenderableSegment || hasTurnActivity) {
      hasTokenRef.current = true;
      setOrbDisposing(true);
    }
  }, [segments, orbDone, activity, turnId]);

  const handleOrbDone = useCallback(() => {
    setOrbDone(true);
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 2: Sequential segment reveal + completion detection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // INVARIANT: Segments render ONE AT A TIME. Segment N+1 does
  // not mount until segment N calls onDone. This is enforced by
  // rendering segments.slice(0, revealedCount + 1).
  //
  // INVARIANT: Turn finalization (onRevealComplete → finalizeTurn)
  // fires EXACTLY ONCE, and ONLY when BOTH conditions are true:
  //   1. All segments have been revealed (revealedCount >= segments.length)
  //   2. turn_end has arrived (onRevealComplete is defined)
  //
  // These two events can arrive in EITHER ORDER:
  //   - Stream finishes first → renderer catches up later → effect fires
  //   - Renderer catches up first → turn_end arrives later → effect fires
  //
  // WHY THIS IS AN EFFECT AND NOT IN THE CALLBACK:
  // onSegmentDone is captured by segment components at mount time via
  // useEffect([], ...). If onRevealComplete changes after mount (turn_end
  // arrives mid-animation), the already-mounted segment has a stale closure.
  // An effect watching [revealedCount, segments.length, onRevealComplete]
  // always sees current values — no stale closures possible.
  //
  // KNOWN PAST BUG (DO NOT REINTRODUCE):
  // Checking completion inside onSegmentDone causes a hang when all
  // segments finish BEFORE turn_end arrives. onRevealComplete is undefined
  // at that point, nobody re-triggers the check, turn hangs forever.
  // The effect-based approach re-evaluates on EVERY change to any input.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // onSegmentDone: ONLY bumps the counter. No completion logic here.
  // Stable callback — no deps, no stale closure risk. Every mounted
  // segment gets the same function reference.
  const onSegmentDone = useCallback((index: number) => {
    setRevealedCount(prev => prev === index ? prev + 1 : prev);
  }, []);

  // Completion detection: reactive effect, not a callback.
  // Fires whenever revealedCount, segments.length, or onRevealComplete changes.
  useEffect(() => {
    if (finalizedRef.current) return;
    if (!onRevealComplete) return;           // turn_end hasn't arrived yet
    if (revealedCount < segments.length) return; // still revealing

    // Both conditions met: all revealed AND turn_end received.
    finalizedRef.current = true;
    onRevealComplete();
  }, [revealedCount, segments.length, onRevealComplete]);

  // Reset on turn change (segments shrink = new turn or thread switch)
  useEffect(() => {
    if (segments.length < prevLenRef.current) {
      setRevealedCount(0);
      finalizedRef.current = false;
    }
    prevLenRef.current = segments.length;
  }, [segments.length]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Stable timing profile
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // This layer provides a stable timing contract. Text and tool reveal speed
  // is controlled by chunk queue lookahead (real buffer depth), not segment
  // backlog. The chunk buffers inside text-animate.ts and tool-animate.ts
  // handle all speed attenuation based on actual queue state.
  //
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Stable getter — segments call this at each decision point. */
  const getTimingProfile = useCallback((): TimingProfile => {
    return DEFAULT_TIMING_PROFILE;
  }, []);

  // ── Render ──

  // Phase 1: Orb is running. Nothing else renders.
  if (!orbDone) {
    return <Orb disposing={orbDisposing} onDone={handleOrbDone} />;
  }

  const working = !terminal && !onRevealComplete && waitingSince !== null
    ? <VisibleWaitActivity key={waitingSince} since={waitingSince} /> : null;

  if (!segments || segments.length === 0) {
    return working ?? <div className="rv-message-assistant-content streaming" />;
  }

  // Mount only completed segments + the one currently animating
  const visibleCount = revealedCount + 1;

  return (
    <>
      {segments.slice(0, visibleCount).map((seg, i) => {
        if (seg.type === 'text') {
          return (
            <LiveTextSegment
              key={`text-${i}`}
              segment={seg}
              index={i}
              progress={observation.segment(i, seg.type, () => seg.content.length)}
              getTimingProfile={getTimingProfile}
              onDone={onSegmentDone}
            />
          );
        }

        return (
          <div key={seg.toolCallId || `seg-${i}`}>
            <LiveToolSegment
              segment={seg}
              index={i}
              progress={observation.segment(i, seg.type, () => seg.content.length)}
              hasQueuedNext={hasQueuedItemAfter(i)}
              hasQueuedItemAfter={hasQueuedItemAfter}
              skipShimmer={i === 0}
              getTimingProfile={getTimingProfile}
              onDone={onSegmentDone}
            />
            {seg.type === 'subagent' && !seg.complete && <SubagentWaitingSegment />}
          </div>
        );
      })}
      {working}
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 2 COMPONENTS — Segment renderers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Live Text Segment ─────────────────────────────────────────────────

interface LiveTextSegmentProps {
  progress: RevealProgress;
  segment: StreamSegment;
  index: number;
  skipAnimation?: boolean;
  getTimingProfile: () => TimingProfile;
  onDone: (index: number) => void;
}

/**
 * LiveTextSegment — Thin shell. All logic lives in text-animate.ts.
 *
 * Owns React state and refs. Delegates animation to animateText().
 * Display state is HTML (pre-rendered by sub-renderers), not raw markdown.
 */
function LiveTextSegment({ progress, segment, index, skipAnimation, getTimingProfile, onDone }: LiveTextSegmentProps) {
  const [displayedHtml, setDisplayedHtml] = useState('');
  const animatingRef = useRef(false);
  const contentRef = useRef(segment.content);
  const completeRef = useRef(segment.complete ?? false);
  const cancelRef = useRef(false);

  contentRef.current = segment.content;
  completeRef.current = segment.complete ?? false;

  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    if (skipAnimation) {
      setDisplayedHtml(renderTextInstant(contentRef.current));
      setTimeout(() => onDone(index), 0);
      return;
    }

    cancelRef.current = false;

    animateText({
      contentRef, completeRef, cancelRef, progress,
      segmentType: segment.type,
      setDisplayedHtml, getTimingProfile,
      onDone: () => onDone(index),
    });

    return () => { cancelRef.current = true; };
  }, []);

  return (
    <div
      className="rv-message-assistant-content streaming"
      dangerouslySetInnerHTML={{ __html: displayedHtml }}
    />
  );
}

// ── Live Tool Segment ─────────────────────────────────────────────────

interface LiveToolSegmentProps {
  progress: RevealProgress;
  hasQueuedNext: boolean;
  hasQueuedItemAfter: (index: number) => boolean;
  segment: StreamSegment;
  index: number;
  /** Skip shimmer delay — used for first segment after orb (orb already bridged the wait) */
  skipShimmer?: boolean;
  skipAnimation?: boolean;
  getTimingProfile: () => TimingProfile;
  onDone: (index: number) => void;
}

/**
 * LiveToolSegment — Phase controller for non-text segments.
 *
 * This is ONLY the phase state machine. It does NOT know how to
 * reveal content. It dispatches to the catalog strategy for
 * strategy, transform, reveal, speed, and result-holding.
 *
 * Phases: shimmer → reveal → collapse → done
 *
 * Timing is stable — getTimingProfile() is called at each phase
 * boundary, returning the stable timing profile. Reveal speed is
 * controlled by chunk queue lookahead inside the reveal controllers.
 */
function LiveToolSegment({ progress, segment, index, hasQueuedNext, hasQueuedItemAfter, skipShimmer, skipAnimation, getTimingProfile, onDone }: LiveToolSegmentProps) {
  const [phase, setPhase] = useState<'shimmer' | 'revealing' | 'collapsing' | 'done'>('shimmer');
  const [expanded, setExpanded] = useState(true);
  const [displayedContent, setDisplayedContent] = useState('');
  const contentRef = useRef(segment.content);
  const completeRef = useRef(segment.complete ?? false);
  const [collapseMs, setCollapseMs] = useState(DEFAULT_TIMING_PROFILE.collapseDuration);
  const interruptCollapseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (hasQueuedNext) interruptCollapseRef.current?.();
  }, [hasQueuedNext]);

  contentRef.current = segment.content;
  completeRef.current = segment.complete ?? false;

  useEffect(() => {
    if (segment.type !== 'subagent') return;
    progress.directOutput(segment.content.length);
    setDisplayedContent(segment.content);
    if (segment.complete) setExpanded(false);
  }, [segment.type, segment.content, segment.complete]);

  useEffect(() => {
    // Each effect invocation has its own cancellation token (including replay).
    const cancelled = { current: false };
    let finishWait: (() => void) | null = null;
    let done = false;
    const wait = (ms: number) => new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timer);
        finishWait = null;
        resolve();
      };
      const timer = setTimeout(finish, ms);
      finishWait = finish;
    });
    const finish = () => {
      if (cancelled.current || done) return;
      done = true;
      progress.setPhase('done');
      onDone(index);
    };
    const cleanup = () => {
      cancelled.current = true;
      interruptCollapseRef.current = null;
      finishWait?.();
    };

    // Subagents are live background ledgers. They must not block later
    // assistant text from rendering, because Kimi can keep emitting
    // SubagentEvent updates after the parent chat has moved on.
    if (segment.type === 'subagent') {
      setDisplayedContent(contentRef.current);
      setPhase('done');
      setExpanded(true);
      void wait(0).then(finish);
      return cleanup;
    }

    // ── Skipped segments render instantly when animation is bypassed ──
    if (skipAnimation) {
      setDisplayedContent(contentRef.current);
      setPhase('done');
      setExpanded(false);
      void wait(0).then(finish);
      return cleanup;
    }

    // ── TIMING: Log when this segment's animate() fires ──
    const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
    const mountAt = performance.now();
    if (t) {
      const sinceSend = t.sendAt ? (mountAt - t.sendAt).toFixed(1) : '?';
      const sinceOrbEnd = t.orbEndAt ? (mountAt - t.orbEndAt).toFixed(1) : 'orb not ended?';
      const sinceFirst = t.firstTokenAt ? (mountAt - t.firstTokenAt).toFixed(1) : 'no token yet';
      console.log(`[TIMING] RENDER SIGNAL (${segment.type} #${index}) at ${mountAt.toFixed(1)}ms — ${sinceSend}ms after send — ${sinceOrbEnd}ms after orb end — ${sinceFirst}ms after first token — content length: ${contentRef.current.length}`);
    }

    const animate = async () => {
      // Phase 1: Shimmer — query timing NOW
      if (!skipShimmer) {
        const p = getTimingProfile();
        if (p.shimmerTotal > 0) {
          await wait(p.shimmerTotal);
          if (cancelled.current) return;
        }
      }

      // Phase 2: Reveal — dispatched to tool-animate.ts (Level 2b controller).
      // The catalog determines strategy, transform, reveal, speed, and
      // result-holding. See lib/catalog.ts.
      setPhase('revealing');
      if (t) {
        const revealAt = performance.now();
        const sinceSend = t.sendAt ? (revealAt - t.sendAt).toFixed(1) : '?';
        console.log(`[TIMING] REVEAL START (${segment.type} #${index}) at ${revealAt.toFixed(1)}ms — ${sinceSend}ms after send`);
      }
      await animateTool({
        contentRef, completeRef, cancelRef: cancelled, progress,
        segmentType: segment.type,
        toolArgs: segment.toolArgs,
        setDisplayedContent,
        getTimingProfile,
        onDone: () => {},  // collapse phase handles the real onDone
      });
      if (cancelled.current) return;

      // Only later renderable items count, never parser chunks of this item.
      // The getter reads current queue bytes even after an awaited reveal.
      let immediate = hasQueuedItemAfter(index);
      const collapseProfile = getTimingProfile();
      interruptCollapseRef.current = () => {
        immediate = true;
        setCollapseMs(0);
        setExpanded(false);
        finishWait?.();
      };
      progress.setPhase('holding');
      setPhase('collapsing');
      setCollapseMs(immediate ? 0 : collapseProfile.collapseDuration);
      if (!immediate && collapseProfile.postTypingPause > 0) await wait(collapseProfile.postTypingPause);
      if (cancelled.current) return;
      progress.setPhase('collapsing');
      setExpanded(false);
      if (!immediate && collapseProfile.collapseDuration > 0) await wait(collapseProfile.collapseDuration);
      if (cancelled.current) return;
      // Retire lookahead before the gap: completed items stay user-expandable.
      interruptCollapseRef.current = null;
      progress.setPhase('gap');
      setPhase('done');
      await wait(100);
      finish();
    };

    animate();
    return cleanup;
  }, []);

  const renderer = getToolRenderer(segment.type);
  const renderedContent = renderer.formatContent(displayedContent, segment.toolArgs, segment);

  return (
    <ToolCallBlock
      type={segment.type}
      label={renderer.buildTitle(segment.groupCount ?? 1, segment.toolArgs, segment)}
      toolArgs={segment.toolArgs}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      shimmer={phase === 'shimmer' || phase === 'revealing'}
      collapseDuration={collapseMs}
    >
      {renderedContent && (
        <div
          style={renderer.contentStyle}
          dangerouslySetInnerHTML={{
            __html: renderedContent,
          }}
        />
      )}
    </ToolCallBlock>
  );
}

function SubagentWaitingSegment() {
  return (
    <div className="rv-tool-fade-in rv-subagent-waiting-segment">
      <HourglassFlow label="Waiting for results from sub-agent..." size="sm" />
    </div>
  );
}
